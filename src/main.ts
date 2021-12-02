
import * as core from '@actions/core'

async function run(): Promise<void> {
  try {
    const safe: string = core.getInput('safe-address')

    core.setOutput('safe', safe)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()