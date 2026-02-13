
import * as dotenv from 'dotenv'
import path from 'path'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

// Load .env.local
const result = dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
console.log('Dotenv loaded:', result.error ? 'Error' : 'Success')
console.log('VENICE_API_KEY:', process.env.VENICE_API_KEY ? 'Present' : 'Missing')

const venice = createOpenAI({
    apiKey: process.env.VENICE_API_KEY,
    baseURL: 'https://api.venice.ai/api/v1',
})

async function testVenice() {
    console.log('Testing Venice API...')
    try {
        const { text } = await generateText({
            model: venice('llama-3.3-70b'),
            prompt: 'Hello, are you working?',
        })
        console.log('Response:', text)
    } catch (error) {
        console.error('Venice API Error:', error)
    }
}

testVenice()
