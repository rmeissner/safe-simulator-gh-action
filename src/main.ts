import * as core from '@actions/core'
import { getMultiSendDeployment, getMultiSendCallOnlyDeployment, getCreateCallDeployment, getSignMessageLibDeployment } from '@gnosis.pm/safe-deployments'
import axios, { AxiosResponse } from 'axios'
import { Simulator } from "./simulator"
import { MultisigTransaction, SafeInfo } from "./types"

const validDelegateCallTargets = [
  getMultiSendCallOnlyDeployment()?.defaultAddress,
  getMultiSendDeployment()?.defaultAddress,
  getCreateCallDeployment()?.defaultAddress,
  getSignMessageLibDeployment()?.defaultAddress,
].filter((value) => value !== undefined)
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
      const simulator = new Simulator(nodeUrl, console.log)
      await simulator.simulateSafeTransaction(safeInfo, transaction)
    }

  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()