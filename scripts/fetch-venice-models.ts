
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const fetchModels = async () => {
    const apiKey = process.env.VENICE_API_KEY
    if (!apiKey) {
        console.error('VENICE_API_KEY not found in .env.local')
        process.exit(1)
    }

    try {
        const response = await fetch('https://api.venice.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        console.log('--- Venice.ai/v1/models ---')
        // Sort by ID for easier reading
        const models = data.data.sort((a: any, b: any) => a.id.localeCompare(b.id))

        models.forEach((model: any) => {
            console.log(`ID: ${model.id} | Owned By: ${model.owned_by}`)
        })
        console.log(`\nTotal Models: ${models.length}`)

    } catch (error: any) {
        console.error('Error:', error.message)
    }
}

fetchModels()
