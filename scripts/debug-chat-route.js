
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function testChatRoute() {
    console.log('Testing /api/chat route...');

    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'What are my tasks for today?' }]
            })
        });

        console.log('Status:', response.status);
        if (!response.ok) {
            const text = await response.text();
            console.log('Error Body:', text);
        } else {
            console.log('Response OK. Stream started...');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                console.log('Received chunk:', chunk.substring(0, 50) + '...');
            }
        }
    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

testChatRoute();
