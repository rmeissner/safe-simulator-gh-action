import * as core from '@actions/core'
import { SimulateCheck, StaticCheck } from './checks'
import { SafeInfoProvider } from './info'
import { evaluateResults } from './results'
import { TargetLoader } from './source'
import { Check, CheckResult, Target } from "./types"

async function run(): Promise<void> {
  try {
    const verbose: boolean = core.getInput('verbose') === 'true'
    const nodeUrl: string = core.getInput('node-url')
    const loader = new TargetLoader()
    const checkTarget: string = core.getInput('check-target')
    const target: Target = await loader.loadTarget(checkTarget)
    const infoProvider = new SafeInfoProvider(nodeUrl)
    const safeInfo = await infoProvider.loadInfo(target.safe)

    if (core.getInput('show-info') === 'true') {
      console.log("Safe Information", safeInfo)
      console.log("Target Information", target)
    }

    const checks: Check[] = []
    checks.push(new StaticCheck())
    if(core.getInput('simulate-tx') === 'true') checks.push(new SimulateCheck(nodeUrl, verbose))
  
    const checkResults: CheckResult[] = []
    for (const check of checks) {
      try {
        checkResults.push(...await check.perform(safeInfo, target))
      } catch (error) {
        console.error(error)
      }
    }
    evaluateResults(checkResults)

  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()