import { BigNumberish, utils } from "ethers";
import { MetaTransaction } from "../types";

const EIP712_SAFESNAP_TYPE = {
    Transaction: [
        { type: "address", name: "to" },
        { type: "uint256", name: "value" },
        { type: "bytes", name: "data" },
        { type: "uint8", name: "operation" },
        { type: "uint256", name: "nonce" },
    ]
}

export const calculateProposalHash = async (module: string, chainId: BigNumberish, moduleTxs: MetaTransaction[]): Promise<{proposalHash: string, txsHashes: string[]}> => {
    const txsHashes = moduleTxs.map((tx) => {
        return utils._TypedDataEncoder.hash({ verifyingContract: module, chainId }, EIP712_SAFESNAP_TYPE, {...tx, nonce: 0}).slice(2)
    })
    const proposalHash = utils.keccak256("0x" + txsHashes.join(""))
    return {
        proposalHash,
        txsHashes
    }
}