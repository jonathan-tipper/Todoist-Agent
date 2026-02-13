
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { createOpenAI } = require('@ai-sdk/openai');
const { streamText } = require('ai');

async function inspectStreamResult() {
    console.log('Inspecting streamText result object...');

    const venice = createOpenAI({
        apiKey: process.env.VENICE_API_KEY,
        baseURL: 'https://api.venice.ai/api/v1',
    });

    try {
        const result = await streamText({
            model: venice('llama-3.3-70b'),
            messages: [{ role: 'user', content: 'Hi' }],
        });

        console.log('Result Keys:', Object.keys(result));
        console.log('Result Prototype Keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(result)));
    } catch (error) {
        console.error('Error:', error);
    }
}

inspectStreamResult();
