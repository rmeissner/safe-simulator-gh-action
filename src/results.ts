import * as core from '@actions/core'
import { CheckResult } from "./types";

export const evaluateResults = (results: CheckResult[]) => {
    const failOnUnknownDelegatecall: boolean = core.getInput('fail-on-unknown-delegatecall') === 'true'
    const failOnSafeStorageChanges: boolean = core.getInput('fail-on-safe-storage-changes') === 'true'
    let shouldFail: boolean = false
    let currentGroup: string | undefined
    for (const result of results) {
        switch (result.id) {
            case "change_safe_storage": {
                shouldFail = shouldFail || failOnSafeStorageChanges
                core.error("Interaction changes Safe storage")
                break
            }
            case "unknown_delegatecall": {
                shouldFail = shouldFail || failOnUnknownDelegatecall
                core.error("Interaction performs a delegatecall to an unknown target")
                break
            }
            case "delegatecall": {
                core.warning("Interaction performs a delegatecall")
                break
            }
            case "target_self": {
                core.warning("Interaction targets the Safe itself")
                break
            }
            case "info": {
                const infoData = result.data
                if (!infoData) break
                if (currentGroup !== infoData.group && currentGroup !== undefined) core.endGroup()
                if (currentGroup !== infoData.group && infoData.group !== undefined) core.startGroup(infoData.group)
                core.info((typeof infoData.message === "string") ? infoData.message : JSON.stringify(infoData.message, null, 3))
                break
            }
        }
    }
    if (currentGroup !== undefined) core.endGroup()
    if (shouldFail)
        core.setFailed("At least one critical check failed")
}