import Ganache, { JsonRpcPayload, JsonRpcResponse } from "ganache-core"
import memdown from "memdown"
import promisify from "util.promisify"
import * as core from '@actions/core'
import { getMultiSendDeployment, getMultiSendCallOnlyDeployment, getCreateCallDeployment, getSignMessageLibDeployment } from '@gnosis.pm/safe-deployments'
import axios, { AxiosResponse } from 'axios'
import { ethers } from "ethers"

const validDelegateCallTargets = [
  getMultiSendCallOnlyDeployment()?.defaultAddress,
  getMultiSendDeployment()?.defaultAddress,
  getCreateCallDeployment()?.defaultAddress,
  getSignMessageLibDeployment()?.defaultAddress,
].filter((value) => value !== undefined)

interface MultisigTransaction {
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

interface SafeInfo {
  owners: string[],
  nonce: number
}

const safeInterface = new ethers.utils.Interface([
  "function approveHash(bytes32) returns (bytes32)",
  "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address payable refundReceiver, bytes calldata signatures) returns (bool)"
])

const executor = (nodeUrl: string) => {
  const db: any = memdown()
  const options: any = { db, db_path: "/", fork: nodeUrl, gasLimit: 100000000, gasPrice: "0" }
  const provider = Ganache.provider(options)
  const execute = promisify(provider.send.bind(provider))
  return async (method: string, params: any[]): Promise<any | undefined> => {
    try {
      const response = await execute({ jsonrpc: "2.0", id: Math.random().toString(35), method, params })
      return response?.result
    } catch (e) {
      console.log(e)
    }
    return undefined
  }
}

async function run(): Promise<void> {
  try {
    const safeAddress: string = core.getInput('safe-address')
    const serviceUrl: string = core.getInput('service-url')
    const safeTxHash: string = core.getInput('safe-tx-hash')
    const nodeUrl: string = core.getInput('node-url')
    const infoResponse: AxiosResponse<SafeInfo> = await axios.get(`${serviceUrl}/api/v1/safes/${safeAddress}`)
    const safeInfo = infoResponse.data
    console.log("Safe Information", safeInfo)

    const txResponse: AxiosResponse<MultisigTransaction> = await axios.get(`${serviceUrl}/api/v1/multisig-transactions/${safeTxHash}`)
    const transaction = txResponse.data
    console.log("Transaction Information", transaction)

    if (transaction.to.toLowerCase() === safeAddress.toLowerCase()) {
      core.warning("Transaction target Safe itself")
    }

    const failOnUnknownDelegatecall: string = core.getInput('fail-on-unknown-delegatecall')
    if (transaction.operation == 1) {
      if (failOnUnknownDelegatecall === "true" && validDelegateCallTargets.indexOf(transaction.to) < 0) {
        throw Error("Invalid delegatecall target")
      }
      core.warning("Transaction performs a delegate call")
    }
    const simulateTx: string = core.getInput('simulate-tx')
    if (simulateTx === "true" && safeInfo.nonce === transaction.nonce) {
      console.log("Simulate Transaction")
      const execute = executor(nodeUrl)
      console.log("Client", await execute("web3_clientVersion", []))
      for (const owner of safeInfo.owners) {
        console.log("Prepare", owner)
        await execute("evm_unlockUnknownAccount", [owner])
        await execute("eth_sendTransaction", [{
          to: safeAddress,
          data: safeInterface.encodeFunctionData("approveHash", [transaction.safeTxHash]),
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
      core.debug("Signatures: " + signatures)
      const ethTxHash = await execute("eth_sendTransaction", [{
        to: safeAddress,
        data: safeInterface.encodeFunctionData("execTransaction", [
          transaction.to,
          transaction.value,
          transaction.data,
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
      const receipt = await execute("eth_getTransactionReceipt", [ethTxHash])
      core.debug("Transaction receipt: " + JSON.stringify(receipt))
      console.log("Logs", receipt?.logs)
    }

  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()