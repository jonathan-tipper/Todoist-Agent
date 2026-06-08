
import { google } from 'googleapis'

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

export const getEvents = async (timeMin?: string, timeMax?: string) => {
    try {
        const calendar = getCalendarClient()
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'
        const response = await calendar.events.list({
            calendarId,
            timeMin: timeMin || new Date().toISOString(),
            timeMax: timeMax,
            singleEvents: true,
            orderBy: 'startTime',
        })

        return (response.data.items || []).map(event => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            location: event.location,
            status: event.status
        }))
    } catch (error) {
        console.error('Error fetching calendar events:', error)
        throw error
    }
}

export const addEvent = async (summary: string, start: string, end: string) => {
    try {
        const calendar = getCalendarClient()
        const event = {
            summary,
            start: { dateTime: start },
            end: { dateTime: end },
        }
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'
        const response = await calendar.events.insert({
            calendarId,
            requestBody: event,
        })
        return response.data
    } catch (error) {
        console.error('Error adding calendar event:', error)
        throw error
    }
}
