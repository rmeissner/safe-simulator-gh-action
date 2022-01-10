import * as core from '@actions/core'
import { validDelegateCallTargets } from './contracts'
import { calculateProposalHash } from './safesnap/hashing'
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

export class SafeSnapCheck implements Check {
  async perform(safeInfo: SafeInfo, target: Target): Promise<CheckResult[]> {
    if (target.type !== "module" || target.context?.type !== "safesnap")
      return []

    const results: CheckResult[] = []
    const hashes = await calculateProposalHash(target.module, safeInfo.chainId, target.txs, target.context.nonces)
    results.push({ id: "info", data: { group: "safesnap", message: `Proposal hash: ${hashes.proposalHash}` } })
    results.push({ id: "info", data: { group: "safesnap", message: `Transaction hashes: ${hashes.txsHashes.join(", ")}` } })
    if(target.context.proposalHash && target.context.proposalHash !== hashes.proposalHash) 
      results.push({ id: "info", data: { group: "safesnap", message: `Calculated hash (${hashes.proposalHash}) is different to expected hash ${target.context.proposalHash}` } })
    return results
  }
}

export class SimulateCheck implements Check {

  private simulator: Simulator

  constructor(nodeUrl: string, verbose?: boolean) {
    this.simulator = new Simulator(nodeUrl, (verbose === true) ? console.debug : undefined)
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
      results.push({ id: "check_error", data: { group: "simulation_error", message: "Simulation failed with: " + errorMessage } })
    }
    return results
  }
}