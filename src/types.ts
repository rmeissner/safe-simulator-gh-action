export interface MetaTransaction {
    to: string,
    value: string,
    data: string,
    operation: number,
}

export interface ModuleTransaction extends MetaTransaction {
    type: "module",
    module: string
}

export interface MultisigTransaction extends MetaTransaction {
    type: "multisig",
    safeTxGas: string,
    baseGas: string,
    gasPrice: string,
    gasToken: string,
    refundReceiver: string,
    nonce: number,
    safeTxHash: string
}

export type SafeTransaction = ModuleTransaction | MultisigTransaction

export interface SafeInfo {
    address: string,
    owners: string[],
    nonce: number
}