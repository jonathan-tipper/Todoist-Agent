import type { Message } from '@ai-sdk/react'

export const HISTORY_LIMIT = 20
export const MESSAGE_LIMIT = 80

export type SavedThread = {
    id: string
    title: string
    createdAt: string
    updatedAt: string
    model: string
    messages: Message[]
}

type BuildThreadListArgs = {
    activeThreadId: string
    previousThreads: SavedThread[]
    messages: Message[]
    selectedModel: string
    now?: string
}

export function createThreadId() {
    return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getChatHistoryKey(accessCode: string) {
    let hash = 0

    for (let i = 0; i < accessCode.length; i += 1) {
        hash = Math.imul(31, hash) + accessCode.charCodeAt(i) | 0
    }

    return `todoist-agent-chat-history:${Math.abs(hash).toString(36)}`
}

export function reviveMessages(messages: Message[]) {
    return messages
        .filter((message): message is Message => (
            typeof message?.id === 'string'
            && typeof message?.role === 'string'
            && typeof message?.content === 'string'
        ))
        .slice(-MESSAGE_LIMIT)
        .map((message) => ({
            ...message,
            createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
        }))
}

function timestamp(value: string) {
    const time = new Date(value).getTime()
    return Number.isNaN(time) ? 0 : time
}

export function parseThreads(rawHistory: string | null): SavedThread[] {
    if (!rawHistory) return []

    try {
        const parsed = JSON.parse(rawHistory)
        if (!Array.isArray(parsed)) return []

        return parsed
            .filter((thread): thread is SavedThread => (
                typeof thread?.id === 'string'
                && typeof thread?.title === 'string'
                && typeof thread?.createdAt === 'string'
                && typeof thread?.updatedAt === 'string'
                && Array.isArray(thread?.messages)
            ))
            .map((thread) => ({
                ...thread,
                model: typeof thread.model === 'string' ? thread.model : '',
                messages: reviveMessages(thread.messages),
            }))
            .sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))
            .slice(0, HISTORY_LIMIT)
    } catch (error) {
        console.error('Unable to parse saved chat history:', error)
        return []
    }
}

export function titleFromMessages(messages: Message[]) {
    const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim())
    if (!firstUserMessage) return 'New chat'

    const title = firstUserMessage.content.replace(/\s+/g, ' ').trim()
    return title.length > 48 ? `${title.slice(0, 45).trimEnd()}...` : title
}

export function buildThreadList({
    activeThreadId,
    previousThreads,
    messages,
    selectedModel,
    now = new Date().toISOString(),
}: BuildThreadListArgs) {
    const existingThread = previousThreads.find((thread) => thread.id === activeThreadId)
    const nextThread: SavedThread = {
        id: activeThreadId,
        title: titleFromMessages(messages),
        createdAt: existingThread?.createdAt || now,
        updatedAt: now,
        model: selectedModel,
        messages: messages.slice(-MESSAGE_LIMIT),
    }

    return [
        nextThread,
        ...previousThreads.filter((thread) => thread.id !== activeThreadId),
    ].slice(0, HISTORY_LIMIT)
}

export function saveThreads(storage: Storage, historyKey: string, threads: SavedThread[]) {
    try {
        storage.setItem(historyKey, JSON.stringify(threads))
        return true
    } catch (error) {
        console.error('Unable to save chat history:', error)
        return false
    }
}
