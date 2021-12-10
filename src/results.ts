import * as core from '@actions/core'
import { CheckResult } from "./types";

export const evaluateResults = (results: CheckResult[]) => {
    const failOnUnknownDelegatecall: boolean = core.getInput('fail-on-unknown-delegatecall') === 'true'
    const failOnSafeStorageChanges: boolean = core.getInput('fail-on-safe-storage-changes') === 'true'
    let shouldFail: boolean = false
    let currentGroup: string | undefined
    for (const result of results) {
        // Handle grouping
        if (currentGroup !== result.data?.group && currentGroup !== undefined) core.endGroup()
        if (currentGroup !== result.data?.group && result.data?.group !== undefined) core.startGroup(result.data.group)
        currentGroup = result.data?.group
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
            case "check_error": {
                shouldFail = true
            }
            case "info": {
                if (!result.data) break
                core.info((typeof result.data.message === "string") ? result.data.message : JSON.stringify(result.data.message, null, 3))
                break
            }
        }
    }
    if (currentGroup !== undefined) core.endGroup()
    if (shouldFail)
        core.setFailed("At least one critical check failed")
}