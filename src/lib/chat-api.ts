import type { CoreMessage } from 'ai'
import { z } from 'zod'

const chatMessageSchema = z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.unknown().optional(),
}).passthrough()

const chatRequestSchema = z.object({
    messages: z.array(chatMessageSchema).min(1, 'messages must contain at least one message'),
    model: z.string().min(1).optional(),
})

export type ChatRequest = {
    messages: CoreMessage[]
    model?: string
}

export function parseChatRequest(value: unknown): ChatRequest {
    const parsed = chatRequestSchema.parse(value)

    return {
        messages: parsed.messages as CoreMessage[],
        model: parsed.model,
    }
}

export function createJsonError(error: string, status: number) {
    return Response.json({ error }, { status })
}

export function isVerboseChatLoggingEnabled(env: NodeJS.ProcessEnv = process.env) {
    return env.NODE_ENV !== 'production' && env.DEBUG_CHAT_LOGS === 'true'
}

export function logChatDebug(...args: unknown[]) {
    if (isVerboseChatLoggingEnabled()) {
        console.log(...args)
    }
}
