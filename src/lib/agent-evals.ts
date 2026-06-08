export type ToolCallExpectation = {
    toolName: string
    path: string
    equals: string | number | boolean | null
}

export type AgentEvalCase = {
    id: string
    behavior: string
    input: string
    expected: {
        requiredTools?: string[]
        forbiddenToolsBeforeConfirmation?: string[]
        requiredToolArgs?: ToolCallExpectation[]
        requiredTextIncludes?: string[]
    }
    mockedOutput: {
        text: string
        toolCalls: Array<{
            toolName: string
            args: Record<string, unknown>
        }>
    }
}

export type AgentEvalResult = {
    id: string
    behavior: string
    passed: boolean
    failures: string[]
}

function getPathValue(value: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, segment) => {
        if (!current || typeof current !== 'object') return undefined
        return (current as Record<string, unknown>)[segment]
    }, value)
}

export function scoreAgentEvalCase(evalCase: AgentEvalCase): AgentEvalResult {
    const failures: string[] = []
    const toolNames = evalCase.mockedOutput.toolCalls.map((toolCall) => toolCall.toolName)

    for (const requiredTool of evalCase.expected.requiredTools || []) {
        if (!toolNames.includes(requiredTool)) {
            failures.push(`Missing required tool: ${requiredTool}`)
        }
    }

    for (const forbiddenTool of evalCase.expected.forbiddenToolsBeforeConfirmation || []) {
        if (toolNames.includes(forbiddenTool)) {
            failures.push(`Forbidden pre-confirmation tool used: ${forbiddenTool}`)
        }
    }

    for (const expectedArg of evalCase.expected.requiredToolArgs || []) {
        const matchingTool = evalCase.mockedOutput.toolCalls.find((toolCall) => toolCall.toolName === expectedArg.toolName)
        const actualValue = matchingTool ? getPathValue(matchingTool.args, expectedArg.path) : undefined

        if (actualValue !== expectedArg.equals) {
            failures.push(`Expected ${expectedArg.toolName}.${expectedArg.path} to equal ${String(expectedArg.equals)}`)
        }
    }

    for (const requiredText of evalCase.expected.requiredTextIncludes || []) {
        if (!evalCase.mockedOutput.text.toLowerCase().includes(requiredText.toLowerCase())) {
            failures.push(`Missing required text: ${requiredText}`)
        }
    }

    return {
        id: evalCase.id,
        behavior: evalCase.behavior,
        passed: failures.length === 0,
        failures,
    }
}

export function scoreAgentEvalCases(evalCases: AgentEvalCase[]) {
    return evalCases.map(scoreAgentEvalCase)
}
