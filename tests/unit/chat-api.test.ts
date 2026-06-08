import { describe, expect, it } from 'vitest'

import {
  createJsonError,
  isVerboseChatLoggingEnabled,
  parseChatRequest,
} from '../../src/lib/chat-api'

describe('parseChatRequest', () => {
  it('accepts non-empty chat messages and an optional model', () => {
    const parsed = parseChatRequest({
      model: 'llama-3.3-70b',
      messages: [
        {
          role: 'user',
          content: 'Plan my day',
        },
      ],
    })

    expect(parsed.model).toBe('llama-3.3-70b')
    expect(parsed.messages).toHaveLength(1)
  })

  it('rejects missing or empty messages', () => {
    expect(() => parseChatRequest({ model: 'llama-3.3-70b' })).toThrow('messages')
    expect(() => parseChatRequest({ messages: [] })).toThrow('messages')
  })
})

describe('createJsonError', () => {
  it('returns structured JSON with the requested status code', async () => {
    const response = createJsonError('Unauthorized', 401)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })
})

describe('isVerboseChatLoggingEnabled', () => {
  it('requires an explicit opt-in outside production', () => {
    expect(isVerboseChatLoggingEnabled({ NODE_ENV: 'development' })).toBe(false)
    expect(isVerboseChatLoggingEnabled({ NODE_ENV: 'development', DEBUG_CHAT_LOGS: 'true' })).toBe(true)
    expect(isVerboseChatLoggingEnabled({ NODE_ENV: 'production', DEBUG_CHAT_LOGS: 'true' })).toBe(false)
  })
})
