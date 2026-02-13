
import dotenv from 'dotenv';
const result = dotenv.config({ path: '.env.local' });

if (result.error) {
    console.error('❌ Failed to load .env.local:', result.error);
} else {
    console.log('✅ Loaded .env.local');
}

async function verify() {
    console.log('--- Starting Integration Verification (Dynamic Imports) ---\n');

    // Dynamic imports ensure env vars are loaded first
    const { createOpenAI } = await import('@ai-sdk/openai');
    const { generateText } = await import('ai');
    const { getTasks } = await import('../src/lib/todoist');
    const { getEvents } = await import('../src/lib/google-calendar');

    // Venice Test
    console.log('Testing Venice.ai...');
    if (!process.env.VENICE_API_KEY) {
        console.error('❌ VENICE_API_KEY is missing.');
    } else {
        try {
            const venice = createOpenAI({
                apiKey: process.env.VENICE_API_KEY,
                baseURL: 'https://api.venice.ai/api/v1',
            });
            const { text } = await generateText({
                model: venice('llama-3.3-70b'),
                prompt: 'Say "Venice is working!"',
            });
            console.log('✅ Venice Response:', text);
        } catch (error: any) {
            console.error('❌ Venice connection failed:', error.message);
            // Print full error if available
            if (error.response) console.error('Status:', error.response.status);
        }
    }

    // Todoist Test
    console.log('\nTesting Todoist...');
    if (!process.env.TODOIST_API_TOKEN) {
        console.error('❌ TODOIST_API_TOKEN is missing.');
    } else {
        try {
            const tasks = await getTasks('today') as any[];
            if (Array.isArray(tasks)) {
                console.log(`✅ Todoist connected. Found ${tasks.length} tasks for today.`);
            } else {
                console.log(`✅ Todoist connected. Response:`, tasks);
            }
        } catch (error: any) {
            console.error('❌ Todoist connection failed:', error.message);
        }
    }

    // Google Calendar Test
    console.log('\nTesting Google Calendar...');
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        console.error('❌ Google Calendar credentials missing.');
    } else {
        try {
            const events = await getEvents();
            console.log(`✅ Google Calendar connected. Found ${events.length} upcoming events.`);
        } catch (error: any) {
            console.error('❌ Google Calendar connection failed:', error.message);
        }
    }

    console.log('\n--- Verification Complete ---');
}

verify();
