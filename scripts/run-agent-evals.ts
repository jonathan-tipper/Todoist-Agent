import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { scoreAgentEvalCases, type AgentEvalCase } from '../src/lib/agent-evals'

async function main() {
    const filePath = resolve(process.cwd(), 'evals/agent-behavior.cases.json')
    const raw = await readFile(filePath, 'utf8')
    const cases = JSON.parse(raw) as AgentEvalCase[]
    const results = scoreAgentEvalCases(cases)
    const failures = results.filter((result) => !result.passed)

    console.log(`Agent evals: ${results.length - failures.length}/${results.length} passed`)

    for (const result of results) {
        const status = result.passed ? 'PASS' : 'FAIL'
        console.log(`${status} ${result.id} (${result.behavior})`)

        for (const failure of result.failures) {
            console.log(`  - ${failure}`)
        }
    }

    if (failures.length > 0) {
        process.exit(1)
    }
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
