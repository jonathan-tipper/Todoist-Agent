import { describe, expect, it } from 'vitest'

import { scoreAgentEvalCase, type AgentEvalCase } from '../../src/lib/agent-evals'

const passingCase: AgentEvalCase = {
  id: 'duration-task',
  behavior: 'duration handling',
  input: 'Add a 45 minute task to review expenses today',
  expected: {
    requiredTools: ['addTask'],
    requiredToolArgs: [
      {
        toolName: 'addTask',
        path: 'duration.amount',
        equals: 45,
      },
    ],
  },
  mockedOutput: {
    text: 'Added the task.',
    toolCalls: [
      {
        toolName: 'addTask',
        args: {
          content: 'Review expenses',
          dueString: 'today',
          duration: { amount: 45, unit: 'minute' },
        },
      },
    ],
  },
}

describe('scoreAgentEvalCase', () => {
  it('passes when mocked output satisfies required tools and arguments', () => {
    expect(scoreAgentEvalCase(passingCase)).toEqual({
      id: 'duration-task',
      behavior: 'duration handling',
      passed: true,
      failures: [],
    })
  })

  it('fails when a required tool call is missing', () => {
    const result = scoreAgentEvalCase({
      ...passingCase,
      mockedOutput: {
        text: 'I can add that.',
        toolCalls: [],
      },
    })

    expect(result.passed).toBe(false)
    expect(result.failures).toContain('Missing required tool: addTask')
  })

  it('fails when a destructive action occurs before confirmation is expected', () => {
    const result = scoreAgentEvalCase({
      id: 'confirm-before-close',
      behavior: 'destructive action confirmation',
      input: 'Maybe mark my tax task complete',
      expected: {
        forbiddenToolsBeforeConfirmation: ['closeTask'],
      },
      mockedOutput: {
        text: 'Marked complete.',
        toolCalls: [{ toolName: 'closeTask', args: { id: '123' } }],
      },
    })

    expect(result.passed).toBe(false)
    expect(result.failures).toContain('Forbidden pre-confirmation tool used: closeTask')
  })
})
