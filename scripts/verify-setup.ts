
import * as dotenv from 'dotenv'
import path from 'path'

// Load .env.local
const result = dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

console.log('Dotenv result:', result.error ? result.error : 'Success')
console.log('TODOIST_API_TOKEN:', process.env.TODOIST_API_TOKEN ? 'Loaded' : 'Not Loaded')

async function verify() {
    // Dynamic import to ensure env vars are loaded first
    const todoist = await import('../src/lib/todoist')
    const calendar = await import('../src/lib/google-calendar')

    console.log('\n--- Verifying Todoist ---')
    try {
        const projects = await todoist.getProjects()
        console.log(`✅ Todoist Connection Successful. Found ${projects.length} projects.`)
        if (projects.length > 0) {
            console.log(`First project: ${projects[0].name} (ID: ${projects[0].id})`)
        }

        const tasks = await todoist.getTasks('today')
        // @ts-ignore
        console.log(`✅ Todoist getTasks('today') Successful. Found ${Array.isArray(tasks) ? tasks.length : 'unknown'} tasks.`)
    } catch (error) {
        console.error('❌ Todoist Connection Failed:', error)
    }

    console.log('\n--- Verifying Google Calendar ---')
    try {
        const events = await calendar.getEvents()
        console.log(`✅ Google Calendar Connection Successful. Found ${events.length} upcoming events.`)
        if (events.length > 0) {
            console.log(`First event: ${events[0].summary} at ${events[0].start}`)
        }
    } catch (error) {
        console.error('❌ Google Calendar Connection Failed:', error)
    }
}

verify().catch(console.error)
