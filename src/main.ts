//import Ganache, { JsonRpcPayload, JsonRpcResponse } from "ganache-core"
//import promisify from "util.promisify"
import * as core from '@actions/core'
import { getMultiSendDeployment, getMultiSendCallOnlyDeployment, getCreateCallDeployment, getSignMessageLibDeployment } from '@gnosis.pm/safe-deployments'
import axios, { AxiosResponse } from 'axios'

const validDelegateCallTargets = [
  getMultiSendCallOnlyDeployment()?.defaultAddress,
  getMultiSendDeployment()?.defaultAddress,
  getCreateCallDeployment()?.defaultAddress,
  getSignMessageLibDeployment()?.defaultAddress,
].filter((value) => value !== undefined)

interface MultisigTransaction {
  to: string
  value: string,
  data: string,
  operation: number
}

async function run(): Promise<void> {
  try {
    const safeAddress: string = core.getInput('safe-address')
    const serviceUrl: string = core.getInput('service-url')
    const safeTxHash: string = core.getInput('safe-tx-hash')
    //const nodeUrl: string = core.getInput('node-url')
    const response: AxiosResponse<MultisigTransaction> = await axios.get(`${serviceUrl}/api/v1/multisig-transactions/${safeTxHash}`)
    const transaction = response.data
    console.log({ transaction })
    if (transaction.operation == 1) {
      if (validDelegateCallTargets.indexOf(transaction.to) < 0) {
        throw Error("Invalid delegatecall target")
      }
      core.warning("Transaction performs a delegate call")
    }

    if (transaction.to.toLowerCase() === safeAddress.toLowerCase()) {
      core.warning("Transaction target Safe itself")
    }
    /*
    const options: Ganache.IProviderOptions = { db_path: "/", fork: nodeUrl, gasLimit: 100000000, gasPrice: "0" }
    const provider = Ganache.provider(options)
    const execute = promisify(provider.send.bind(provider))
    */

  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()