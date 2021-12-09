import { ModuleTransaction, MultisigTransaction, SafeTransaction } from "./types"
import axios, { AxiosResponse } from 'axios'
import { ethers } from "ethers";
import { pack } from '@ethersproject/solidity';
import { hexDataLength, isHexString } from '@ethersproject/bytes';
import { context, getOctokit } from "@actions/github";
import { toolkit } from "./config";

const multisendInterface = new ethers.utils.Interface(['function multiSend(bytes memory transactions)'])
const MULTISEND_CONTRACT_ADDRESS = '0x8D29bE29923b68abfDD21e541b9374737B49cdAD'

const encodePackageMultiSendTransaction = (transaction: ModuleTransaction) => {
    const data = transaction.data || '0x';
    return pack(
        ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
        [
            transaction.operation,
            transaction.to,
            transaction.value,
            hexDataLength(data),
            data
        ]
    );
};

const removeHexPrefix = (hexString: string) => {
    return hexString.startsWith('0x') ? hexString.substr(2) : hexString;
};

export class TargetLoader {

    private async loadFileContent(path: string): Promise<string> {
        const file = await toolkit.repos.getContent({
            mediaType: {
                format: "raw"
            },
            ...context.repo,
            path: path,
            ref: context.ref
        })
        const content = file.data
        if (!content || typeof content !== "string") throw Error(`File "${path}" not found`)
        return content
    }

    private buildModuleTx(module: string, subTxs: any): ModuleTransaction {
        if (!Array.isArray(subTxs)) return {
            type: "module",
            module,
            to: subTxs.to,
            value: subTxs.value,
            data: subTxs.data,
            operation: subTxs.operation
        }
        const transactionsEncoded =
            '0x' +
            subTxs
                .map(encodePackageMultiSendTransaction)
                .map(removeHexPrefix)
                .join('');
        const value: string = '0';
        const data = multisendInterface.encodeFunctionData('multiSend', [
            transactionsEncoded
        ]);

        return {
            type: "module",
            module,
            to: MULTISEND_CONTRACT_ADDRESS,
            operation: 1,
            value: "0",
            data
        };
    }

    private async loadSafeSnapTransactions(ipfsHash: string): Promise<ModuleTransaction[]> {
        const proposalContent = await this.loadFileContent(`safesnap/${ipfsHash}/details.json`)
        const proposal = JSON.parse(proposalContent)
        if (!proposal.data.message.plugins) throw Error("Invalid proposal")
        const pluginData = JSON.parse(proposal.data.message.plugins)
        if (!pluginData.safeSnap) throw Error("No SafeSnap found")
        if (!pluginData.safeSnap.safes) throw Error("No Safe in SafeSnap found")
        if (!Array.isArray(pluginData.safeSnap.safes) || pluginData.safeSnap.safes.length != 1) throw Error("Unsupported Safes")
        const safesnapData = pluginData.safeSnap.safes[0]
        if (!safesnapData.realityAddress) throw Error("Invalid SafeSnap realityAddress")
        if (!Array.isArray(safesnapData.txs)) throw Error("Invalid SafeSnap transactions")
        return safesnapData.txs.map((tx: any) => {
            return this.buildModuleTx(safesnapData.realityAddress, tx)
        })
    }

    private async loadMultiSigTransaction(safeTxHash: string): Promise<SafeTransaction> {
        const txContent = await this.loadFileContent(`multisig/${safeTxHash}/details.json`)
        const tx = JSON.parse(txContent)
        tx.type = "multisig"
        return tx
    }

    private async loadModuleTransaction(id: string): Promise<ModuleTransaction> {
        const txContent = await this.loadFileContent(`module/${id}/details.json`)
        const tx = JSON.parse(txContent)
        tx.type = "module"
        return tx
    }

    async loadTarget(target: string): Promise<SafeTransaction[]> {
        const targetParts = target.split("/")
        if (targetParts.length < 2) throw Error("Invalid target")
        switch (targetParts[0]) {
            case "multisig":
                return [await this.loadMultiSigTransaction(targetParts[1])]
            case "safesnap":
                return await this.loadSafeSnapTransactions(targetParts[1])
            case "module":
                return [await this.loadModuleTransaction(targetParts[1])]
            default:
                throw Error("Invalid target")
        }
    }
}