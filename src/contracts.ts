import { ethers } from "ethers";
import { getMultiSendDeployment, getMultiSendCallOnlyDeployment, getCreateCallDeployment, getSignMessageLibDeployment } from '@gnosis.pm/safe-deployments'

export const safeInterface = new ethers.utils.Interface([
    "function nonce() returns (uint256)",
    "function getOwners() returns (uint256)",
    "function approveHash(bytes32) returns (bytes32)",
    "function enableModule(address module)",
    "function execTransactionFromModule(address to, uint256 value, bytes calldata data, uint8 operation) returns (bool)",
    "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) returns (bool)",
    "function getTransactionHash(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) returns (bytes32)"
])

export const validDelegateCallTargets = [
    getMultiSendCallOnlyDeployment()?.defaultAddress,
    getMultiSendDeployment()?.defaultAddress,
    getCreateCallDeployment()?.defaultAddress,
    getSignMessageLibDeployment()?.defaultAddress,
].filter((value) => value !== undefined)