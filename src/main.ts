import Ganache, { JsonRpcPayload, JsonRpcResponse } from "ganache-core"
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
  operation: number
}

interface SafeInfo {
  owners: string[]
}

const safeInterface = new ethers.utils.Interface(["function approveHash(bytes32)"])

const executor = (provider: Ganache.Provider) => {
  const execute = promisify(provider.send.bind(provider))
  return async (method: string, params: any[]): Promise<JsonRpcResponse | undefined> => {
    console.log("JSON RPC", method, params)
    try {
      const response = await execute({ jsonrpc: "2.0", method, params })
      console.log({ response })
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
    const response: AxiosResponse<MultisigTransaction> = await axios.get(`${serviceUrl}/api/v1/multisig-transactions/${safeTxHash}`)
    const transaction = response.data
    console.log({ transaction })

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
    if (simulateTx == "true") {
      const response: AxiosResponse<SafeInfo> = await axios.get(`${serviceUrl}/api/v1/safes/${safeAddress}`)
      const safeInfo = response.data
      console.log({ safeInfo })
      const options: Ganache.IProviderOptions = { db_path: "/", fork: nodeUrl, gasLimit: 100000000, gasPrice: "0" }
      const execute = executor(Ganache.provider(options))
      console.log("Owners", safeInfo.owners)
      console.log("Client", await execute("web3_clientVersion", []))
      for (const owner of safeInfo.owners) {
        console.log("Process", owner)
        console.log("Unlock", owner, await execute("evm_unlockUnknownAccount", [owner]))
        console.log("Transaction", owner, await execute("eth_sendTransaction", [{
          to: safeAddress,
          data: safeInterface.encodeFunctionData("approveHash", [transaction.safeTxHash]),
          from: owner,
          gasPrice: 0,
          gasLimit: 10000000
        }]))
      }
    }

  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()