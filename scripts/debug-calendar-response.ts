
import { google } from 'googleapis'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SCOPES = ['https://www.googleapis.com/auth/calendar']

const getCalendarClient = () => {
    const email = process.env.GOOGLE_CLIENT_EMAIL
    const key = process.env.GOOGLE_PRIVATE_KEY

    if (!email || !key) {
        throw new Error('Missing Google Calendar credentials')
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: email,
            private_key: key.replace(/\\n/g, '\n'),
        },
        scopes: SCOPES,
    })

    return google.calendar({
        version: 'v3',
        auth,
    })
}

const debugCalendarResponse = async () => {
    try {
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'
        console.log(`Fetching events from: ${calendarId}`)

        const calendar = getCalendarClient()
        const response = await calendar.events.list({
            calendarId,
            timeMin: new Date().toISOString(),
            maxResults: 5,
            singleEvents: true,
            orderBy: 'startTime',
        })

        console.log('--- Raw Response Data Items ---')
        if (response.data.items && response.data.items.length > 0) {
            // Log the structure of the first event to see what we're dealing with
            console.log(JSON.stringify(response.data.items[0], null, 2))

            // Simulation of simplified structure
            console.log('\n--- Proposed Simplified Structure ---')
            const simplified = response.data.items.map(event => ({
                id: event.id,
                summary: event.summary,
                start: event.start?.dateTime || event.start?.date,
                end: event.end?.dateTime || event.end?.date,
                description: event.description,
                location: event.location,
                status: event.status
            }))
            console.log(JSON.stringify(simplified, null, 2))
        } else {
            console.log('No events found.')
        }

    } catch (error: any) {
        console.error('Error:', error.message)
        if (error.response) {
            console.error('API Error Response:', JSON.stringify(error.response.data, null, 2))
        }
    }
}

debugCalendarResponse()
