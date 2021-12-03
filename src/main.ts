import * as core from '@actions/core'
import { getMultiSendDeployment, getMultiSendCallOnlyDeployment, getCreateCallDeployment, getSignMessageLibDeployment } from '@gnosis.pm/safe-deployments'
import axios, { AxiosResponse } from 'axios'
import { Simulator } from "./simulator"
import { TargetLoader } from './source'
import { SafeInfo, SafeTransaction } from "./types"

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
    const ipfsUrl: string = core.getInput('ipfs-url')
    const nodeUrl: string = core.getInput('node-url')
    const loader = new TargetLoader(serviceUrl, ipfsUrl)

    const infoResponse: AxiosResponse<SafeInfo> = await axios.get(`${serviceUrl}/api/v1/safes/${safeAddress}`)
    const safeInfo = infoResponse.data
    console.log("Safe Information", safeInfo)

    const checkTarget: string = core.getInput('check-target')
    const transactions: SafeTransaction[] = await loader.loadTarget(checkTarget)
    for (const transaction of transactions) {
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
      if (simulateTx === "true") {
        const simulator = new Simulator(nodeUrl, console.log)
        switch (transaction.type) {
          case "multisig":
            await simulator.simulateMultiSigTransaction(safeInfo, transaction)
            break;
          case "module":
            await simulator.simulateModuleTransaction(safeInfo, transaction)
            break;
        }
      }
    }

  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()