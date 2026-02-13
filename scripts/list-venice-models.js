
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function listModels() {
    const key = process.env.VENICE_API_KEY;
    try {
        const response = await fetch('https://api.venice.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        const data = await response.json();
        if (data.data) {
            console.log('Available Models:', data.data.map(m => m.id).join(', '));
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

listModels();
