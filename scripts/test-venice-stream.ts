
import * as dotenv from 'dotenv'
import path from 'path'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText, tool } from 'ai'
import { z } from 'zod'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const venice = createOpenAI({
    apiKey: process.env.VENICE_API_KEY,
    baseURL: 'https://api.venice.ai/api/v1',
})

const SYSTEM_PROMPT = `You are a "Proactive Life Planner" AI assistant.`

async function testStream() {
    console.log('Testing streamText with tools...')
    try {
        const result = streamText({
            model: venice('llama-3.3-70b'),
            messages: [{ role: 'user', content: 'Plan my day' }],
            system: SYSTEM_PROMPT,
            tools: {
                getTasks: tool({
                    description: 'Get active tasks from Todoist.',
                    parameters: z.object({ filter: z.string().optional() }),
                    execute: async ({ filter }) => {
                        console.log('Calling getTasks logic...')
                        return [{ id: '1', content: 'Test Task' }]
                    },
                }),
            },
            onFinish: (event) => {
                console.log('Stream finished. Usage:', event.usage)
                console.log('Finish reason:', event.finishReason)
                console.log('Text:', event.text)
                console.log('ToolCalls:', event.toolCalls)
            },
            onError: (error) => {
                console.error('Stream error:', error)
            }
        })

        for await (const chunk of result.textStream) {
            process.stdout.write(chunk)
        }
        console.log('\nDone.')
    } catch (error) {
        console.error('Test Error:', error)
    }
}

testStream()
