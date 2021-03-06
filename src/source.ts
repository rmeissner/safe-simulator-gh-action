import { MetaTransaction, ModuleTarget, MultisigTarget, Target } from "./types"
import { ethers } from "ethers";
import { pack } from '@ethersproject/solidity';
import { hexDataLength, isHexString } from '@ethersproject/bytes';
import { context, getOctokit } from "@actions/github";
import { toolkit } from "./config";

const multisendInterface = new ethers.utils.Interface(['function multiSend(bytes memory transactions)'])
const MULTISEND_CONTRACT_ADDRESS = '0x8D29bE29923b68abfDD21e541b9374737B49cdAD'

const encodePackageMultiSendTransaction = (transaction: MetaTransaction) => {
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

    private buildModuleTx(subTxs: any): MetaTransaction {
        if (!Array.isArray(subTxs)) return {
            to: subTxs.to,
            value: subTxs.value,
            data: subTxs.data,
            operation: subTxs.operation
        }
        if (subTxs.length === 1) {
            const subTx = subTxs[0]
            return {
                to: subTx.to,
                value: subTx.value,
                data: subTx.data,
                operation: subTx.operation
            }
        }
        const transactionsEncoded =
            '0x' +
            subTxs
                .map(encodePackageMultiSendTransaction)
                .map(removeHexPrefix)
                .join('');
        const data = multisendInterface.encodeFunctionData('multiSend', [
            transactionsEncoded
        ]);

        return {
            to: MULTISEND_CONTRACT_ADDRESS,
            operation: 1,
            value: "0",
            data
        };
    }

    private getNonce(subTxs: any, fallback: number): number {
        if (!Array.isArray(subTxs)) return subTxs.nonce
        if (subTxs.length === 1) {
            const subTx = subTxs[0]
            return subTx.nonce
        }
        return fallback
    }

    private async loadSafeSnapTransactions(ipfsHash: string): Promise<ModuleTarget> {
        const detailsContent = await this.loadFileContent(`safesnap/${ipfsHash}/details.json`)
        const details = JSON.parse(detailsContent)
        const space = details.space
        const proposal = details.proposal
        if (!proposal.data.message.plugins) throw Error("Invalid proposal")
        const pluginData = JSON.parse(proposal.data.message.plugins)
        if (!pluginData.safeSnap) throw Error("No SafeSnap found")
        if (!pluginData.safeSnap.safes) throw Error("No Safe in SafeSnap found")
        if (!Array.isArray(pluginData.safeSnap.safes) || pluginData.safeSnap.safes.length != 1) throw Error("Unsupported Safes")
        const safesnapData = pluginData.safeSnap.safes[0]
        if (!safesnapData.realityAddress) throw Error("Invalid SafeSnap realityAddress")
        if (!Array.isArray(safesnapData.txs)) throw Error("Invalid SafeSnap transactions")
        return {
            type: "module",
            safe: space.safe,
            module: safesnapData.realityAddress,
            context: {
                type: "safesnap",
                proposalHash: safesnapData.hash,
                nonces: safesnapData.txs.map((tx: any, index: number) => {
                    if (!Array.isArray(tx) && tx.nonce)
                        return tx.nonce
                    return this.getNonce(tx, index)
                })
            },
            txs: safesnapData.txs.map((tx: any) => {
                if (!Array.isArray(tx) && tx.transactions)
                    return this.buildModuleTx(tx.transactions)
                return this.buildModuleTx(tx)
            })
        }
    }

    private async loadMultiSigTransaction(safeTxHash: string): Promise<MultisigTarget> {
        const detailsContent = await this.loadFileContent(`multisig/${safeTxHash}/details.json`)
        const details = JSON.parse(detailsContent)
        return {
            type: "multisig",
            safe: details.safe,
            tx: details.tx
        }
    }

    private async loadModuleTransaction(id: string): Promise<ModuleTarget> {
        const detailsContent = await this.loadFileContent(`module/${id}/details.json`)
        const details = JSON.parse(detailsContent)
        return {
            type: "module",
            safe: details.safe,
            module: details.module,
            txs: details.txs
        }
    }

    async loadTarget(target: string): Promise<Target> {
        const targetParts = target.split("/")
        if (targetParts.length < 2) throw Error("Invalid target")
        switch (targetParts[0]) {
            case "multisig":
                return await this.loadMultiSigTransaction(targetParts[1])
            case "safesnap":
                return await this.loadSafeSnapTransactions(targetParts[1])
            case "module":
                return await this.loadModuleTransaction(targetParts[1])
            default:
                throw Error("Invalid target")
        }
    }
}