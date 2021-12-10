import { getAddress } from "@ethersproject/address"
import { ethers } from "ethers"
import Ganache, { JsonRpcPayload, JsonRpcResponse } from "ganache-core"
import promisify from "util.promisify"
import { safeInterface } from "./contracts"
import { LoggingDb } from "./db"
import { CheckResult, MetaTransaction, MultisigTransaction, SafeInfo } from "./types"

interface RpcProvider {
    send(method: string, params: any[]): Promise<any | undefined>
}

export class ForkedProvider implements RpcProvider {

    readonly db: LoggingDb
    readonly provider: Ganache.Provider
    private sendAsync: (arg: JsonRpcPayload) => Promise<JsonRpcResponse | undefined>

    constructor(nodeUrl: string) {
        this.db = new LoggingDb()
        const options: any = { db: this.db, db_path: "/", fork: nodeUrl, gasLimit: 100000000, gasPrice: "0" }
        this.provider = Ganache.provider(options)
        this.sendAsync = promisify(this.provider.send.bind(this.provider))
    }

    setDbLogging(enabled: boolean) {
        this.db.logging = enabled
    }

    clearTouched() {
        this.db.touched.clear()
    }

    getTouched(): Set<string> {
        return this.db.touched
    }

    async send(method: string, params: any[]) {
        const response = await this.sendAsync({ jsonrpc: "2.0", id: Math.random().toString(35), method, params })
        if (!response) throw Error("No response")
        if (response.error) {
            throw Error(response.error)
        }
        return response.result
    }
}

export class Simulator {

    readonly provider: ForkedProvider
    private logger?: (message?: any, ...optionalParams: any[]) => void

    constructor(nodeUrl: string, logger?: (message?: any, ...optionalParams: any[]) => void) {
        this.provider = new ForkedProvider(nodeUrl)
        this.logger = logger
    }

    private async getHashForCurrentNonce(safeInfo: SafeInfo, transaction: MultisigTransaction) {
        return await this.provider.send("eth_call", [{
            to: safeInfo.address,
            data: safeInterface.encodeFunctionData("getTransactionHash", [
                transaction.to,
                transaction.value,
                transaction.data,
                transaction.operation,
                transaction.safeTxGas,
                transaction.baseGas,
                transaction.gasPrice,
                transaction.gasToken,
                transaction.refundReceiver,
                safeInfo.nonce
            ])
        }, "latest"])
    }

    private async evaluateChanges(safeAddress: string, results?: CheckResult[]) {
        const touched = this.provider.getTouched()
        const blockNumber = ethers.BigNumber.from(await this.provider.send("eth_blockNumber", []))
        for (const value of touched) {
            const parts = value.replace("!trie_db!!touched!", "").split(";")
            if (parts.length != 2) continue
            const storageBefore = await this.provider.send("eth_getStorageAt", [parts[0], parts[1], blockNumber.sub(1).toHexString()])
            const storageAfter = await this.provider.send("eth_getStorageAt", [parts[0], parts[1], blockNumber.toHexString()])
            if (storageBefore !== storageAfter) {
                const storageOwner = getAddress(parts[0])
                const data = {
                    group: "state_changes",
                    messages: `Storage of ${storageOwner} at ${parts[1]} changed from ${storageBefore} to ${storageAfter}`
                } 
                if (storageOwner === safeAddress) {
                    results?.push({ id: "change_safe_storage", data })
                } else {
                    results?.push({ id: "info", data })
                }
            }
        }
    }

    private async evaluateLogs(txHash: string, results?: CheckResult[]) {
        const receipt = await this.provider.send("eth_getTransactionReceipt", [txHash])
        const logs = receipt?.logs
        if (!logs) return
        this.logger?.("Logs", receipt?.logs)
        for(const log of logs) {
            const data = {
                group: "logs",
                messages: log
            }
            results?.push({ id: "info", data })
        }
    }

    async simulateMultiSigTransaction(safeInfo: SafeInfo, transaction: MultisigTransaction, results?: CheckResult[]) {
        this.logger?.("Simulate Multisig Transaction")
        this.logger?.("Client", await this.provider.send("web3_clientVersion", []))
        const approveHash = safeInfo.nonce === transaction.nonce ? transaction.safeTxHash : await this.getHashForCurrentNonce(safeInfo, transaction)
        for (const owner of safeInfo.owners) {
            this.logger?.("Prepare", owner)
            await this.provider.send("evm_unlockUnknownAccount", [owner])
            await this.provider.send("eth_sendTransaction", [{
                to: safeInfo.address,
                data: safeInterface.encodeFunctionData("approveHash", [approveHash]),
                from: owner,
                gasPrice: 0,
                gasLimit: 10000000
            }])
        }
        const signatures = "0x" + safeInfo.owners
            .map(owner => owner.toLowerCase())
            .sort()
            .map((owner) => `000000000000000000000000${owner.slice(2)}000000000000000000000000000000000000000000000000000000000000000001`)
            .join("")
        this.logger?.("Signatures: " + signatures)
        this.provider.setDbLogging(true)
        this.provider.clearTouched()
        const ethTxHash = await this.provider.send("eth_sendTransaction", [{
            to: safeInfo.address,
            data: safeInterface.encodeFunctionData("execTransaction", [
                transaction.to,
                transaction.value,
                transaction.data || "0x",
                transaction.operation,
                transaction.safeTxGas,
                transaction.baseGas,
                transaction.gasPrice,
                transaction.gasToken,
                transaction.refundReceiver,
                signatures
            ]),
            from: safeInfo.owners[0],
            gasPrice: 0,
            gasLimit: 10000000
        }])
        this.provider.setDbLogging(false)
        await this.evaluateChanges(safeInfo.address, results)
        await this.evaluateLogs(ethTxHash, results)
    }

    async simulateModuleTransaction(safeInfo: SafeInfo, module: string, transaction: MetaTransaction, results?: CheckResult[]) {
        this.logger?.("Simulate Module Transaction")
        this.logger?.("Client", await this.provider.send("web3_clientVersion", []))
        await this.provider.send("evm_unlockUnknownAccount", [module])
        this.provider.setDbLogging(true)
        this.provider.clearTouched()
        const ethTxHash = await this.provider.send("eth_sendTransaction", [{
            to: safeInfo.address,
            data: safeInterface.encodeFunctionData("execTransactionFromModule", [
                transaction.to,
                transaction.value,
                transaction.data,
                transaction.operation
            ]),
            from: module,
            gasPrice: 0,
            gasLimit: 10000000
        }])
        this.provider.setDbLogging(false)
        await this.evaluateChanges(safeInfo.address, results)
        await this.evaluateLogs(ethTxHash, results)
    }
}