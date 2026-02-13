
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function verifyVeniceChat() {
    const key = process.env.VENICE_API_KEY;
    const model = 'llama-3.3-70b';

    console.log(`Testing Chat Completion with model: ${model}`);

    try {
        const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'user', content: 'Say hello!' }
                ],
                max_tokens: 10
            })
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Body:', text);

        if (response.ok) {
            console.log('✅ Chat verification successful');
        } else {
            console.log('❌ Chat verification failed');
        }
    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

verifyVeniceChat();
