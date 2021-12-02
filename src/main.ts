//import Ganache, { JsonRpcPayload, JsonRpcResponse } from "ganache-core"
//import promisify from "util.promisify"
import * as core from '@actions/core'
import axios from 'axios'

interface MultisigTransaction {
  to: string
  value: string,
  data: string,
  operation: string
}

async function run(): Promise<void> {
  try {
    const safe: string = core.getInput('safe-address')
    const serviceUrl: string = core.getInput('service-url')
    const safeTxHash: string = core.getInput('safe-tx-hash')
    //const nodeUrl: string = core.getInput('node-url')
    const response: MultisigTransaction = await axios.get(`${serviceUrl}/api/v1/multisig-transactions/${safeTxHash}`)
    console.log({response})
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