
import { google } from 'googleapis'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SCOPES = ['https://www.googleapis.com/auth/calendar']

const getCalendarClient = () => {
    const email = process.env.GOOGLE_CLIENT_EMAIL
    const key = process.env.GOOGLE_PRIVATE_KEY

    console.log('Using email:', email)
    // console.log('Using key:', key ? 'Key present' : 'Key missing')

    if (!email || !key) {
        throw new Error('Missing Google Calendar credentials')
    }

    // Use GoogleAuth instead of JWT directly
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: email,
            private_key: key.replace(/\\n/g, '\n'),
        },
        scopes: SCOPES,
    })

    const calendar = google.calendar({
        version: 'v3',
        auth,
    })

    return calendar
}

const testCalendar = async () => {
    try {
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'
        console.log(`Attempting to fetch calendar events from: ${calendarId}`)
        const calendar = getCalendarClient()
        const response = await calendar.events.list({
            calendarId,
            timeMin: new Date().toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        })
        console.log('Successfully fetched events:', response.data.items?.length)
        if (response.data.items && response.data.items.length > 0) {
            console.log('First event:', response.data.items[0].summary)
        } else {
            console.log('No events found.')
        }
    } catch (error: any) {
        console.error('Error fetching calendar events:', error.message)
        if (error.response) {
            console.error('Response data:', error.response.data)
        }
    }
}

testCalendar()
