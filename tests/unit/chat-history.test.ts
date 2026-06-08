import { describe, expect, it, vi } from 'vitest'

import {
  buildThreadList,
  getChatHistoryKey,
  parseThreads,
  saveThreads,
  titleFromMessages,
  type SavedThread,
} from '../../src/lib/chat-history'

const now = '2026-06-08T16:00:00.000Z'
const nowDate = new Date(now)

function message(id: string, content: string, role: 'user' | 'assistant' = 'user') {
  return {
    id,
    role,
    content,
    createdAt: nowDate,
  }
}

function thread(id: string, updatedAt: string, messages = [message(`${id}-message`, id)]): SavedThread {
  return {
    id,
    title: id,
    createdAt: '2026-06-08T15:00:00.000Z',
    updatedAt,
    model: 'llama-3.3-70b',
    messages,
  }
}

describe('getChatHistoryKey', () => {
  it('creates stable access-code scoped keys without storing the raw code', () => {
    expect(getChatHistoryKey('secret-code')).toBe(getChatHistoryKey('secret-code'))
    expect(getChatHistoryKey('secret-code')).not.toBe(getChatHistoryKey('other-code'))
    expect(getChatHistoryKey('secret-code')).not.toContain('secret-code')
  })
})

describe('parseThreads', () => {
  it('returns an empty list for missing, invalid, or non-array history', () => {
    expect(parseThreads(null)).toEqual([])
    expect(parseThreads('{bad json')).toEqual([])
    expect(parseThreads(JSON.stringify({ id: 'not-array' }))).toEqual([])
  })

  it('filters invalid records, revives message dates, sorts newest first, and applies limits', () => {
    const messages = Array.from({ length: 90 }, (_, index) => message(`m-${index}`, `message ${index}`))
    const rawThreads = [
      { id: 'invalid-no-title', messages: [] },
      ...Array.from({ length: 22 }, (_, index) => thread(`thread-${index}`, `2026-06-08T15:${String(index).padStart(2, '0')}:00.000Z`, messages)),
    ]

    const parsed = parseThreads(JSON.stringify(rawThreads))

    expect(parsed).toHaveLength(20)
    expect(parsed[0].id).toBe('thread-21')
    expect(parsed.at(-1)?.id).toBe('thread-2')
    expect(parsed[0].messages).toHaveLength(80)
    expect(parsed[0].messages[0].id).toBe('m-10')
    expect(parsed[0].messages[0].createdAt).toBeInstanceOf(Date)
  })
})

describe('titleFromMessages', () => {
  it('uses the first non-empty user message and truncates long titles', () => {
    const title = titleFromMessages([
      message('assistant-first', 'Ignore assistant', 'assistant'),
      message('empty', '   '),
      message('user-first', '  This is a deliberately long planning request that should be truncated neatly  '),
    ])

    expect(title).toBe('This is a deliberately long planning request...')
  })

  it('falls back for empty conversations', () => {
    expect(titleFromMessages([])).toBe('New chat')
  })
})

describe('buildThreadList', () => {
  it('upserts the active thread, keeps creation time, stores newest messages, and trims history', () => {
    const existing = Array.from({ length: 20 }, (_, index) => thread(`old-${index}`, `2026-06-08T14:${String(index).padStart(2, '0')}:00.000Z`))
    const active = thread('active', '2026-06-08T14:59:00.000Z')
    const messages = Array.from({ length: 85 }, (_, index) => message(`active-${index}`, index === 0 ? 'Plan my day' : `message ${index}`))

    const next = buildThreadList({
      activeThreadId: active.id,
      previousThreads: [active, ...existing],
      messages,
      selectedModel: 'llama-3.3-70b',
      now,
    })

    expect(next).toHaveLength(20)
    expect(next[0].id).toBe('active')
    expect(next[0].createdAt).toBe(active.createdAt)
    expect(next[0].messages).toHaveLength(80)
    expect(next[0].messages[0].id).toBe('active-5')
    expect(next.some((item) => item.id === 'old-19')).toBe(false)
  })
})

describe('saveThreads', () => {
  it('returns false when storage quota or privacy errors prevent persistence', () => {
    const storage = {
      setItem: vi.fn(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }),
    } as unknown as Storage

    expect(saveThreads(storage, 'history-key', [])).toBe(false)
  })

  it('serializes threads when storage accepts the update', () => {
    const storage = {
      setItem: vi.fn(),
    } as unknown as Storage

    expect(saveThreads(storage, 'history-key', [thread('saved', now)])).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith('history-key', expect.stringContaining('"id":"saved"'))
  })
})
