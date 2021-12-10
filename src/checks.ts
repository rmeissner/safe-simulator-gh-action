import * as core from '@actions/core'
import { validDelegateCallTargets } from './contracts'
import { Simulator } from './simulator'
import { Check, CheckResult, MetaTransaction, SafeInfo, Target } from "./types"

const staticCheckTransaction = async (executor: string, transaction: MetaTransaction, results: CheckResult[]) => {
  if (transaction.to.toLowerCase() === executor.toLowerCase()) {
    results.push({ id: "target_self" })
  }
  if (transaction.operation == 1) {
    if (validDelegateCallTargets.indexOf(transaction.to) < 0) {
      results.push({ id: "unknown_delegatecall" })
    } else {
      results.push({ id: "delegatecall" })
    }
  }
}

export class StaticCheck implements Check {
  async perform(safeInfo: SafeInfo, target: Target): Promise<CheckResult[]> {
    const results: CheckResult[] = []
    switch (target.type) {
      case "multisig":
        await staticCheckTransaction(safeInfo.address, target.tx, results)
        break;
      case "module":
        for (const transaction of target.txs)
          await staticCheckTransaction(safeInfo.address, transaction, results)
        break;
    }
    return results
  }
}

export class SimulateCheck implements Check {

  private simulator: Simulator

  constructor (nodeUrl: string) {
    this.simulator = new Simulator(nodeUrl, console.debug)
  }

  async perform(safeInfo: SafeInfo, target: Target): Promise<CheckResult[]> {
    const results: CheckResult[] = []
    try {
      switch (target.type) {
        case "multisig":
          await this.simulator.simulateMultiSigTransaction(safeInfo, target.tx, results)
          break;
        case "module":
          for (const transaction of target.txs)
            await this.simulator.simulateModuleTransaction(safeInfo, target.module, transaction, results)
          break;
      }
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : JSON.stringify(error)
      results.push({id: "check_error", data: { group: "simulation_error", message: "Simulation failed with: " + errorMessage}})
    }
    return results
  }
}