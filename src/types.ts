export interface MultisigTransaction {
    safeTxHash: string,
    to: string,
    value: string,
    data: string,
    operation: number,
    safeTxGas: string,
    baseGas: string,
    gasPrice: string,
    gasToken: string,
    refundReceiver: string,
    nonce: number
}

export interface SafeInfo {
    address: string,
    owners: string[],
    nonce: number
}