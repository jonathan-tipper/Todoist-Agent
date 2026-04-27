
import { createOpenAI } from '@ai-sdk/openai'
import { streamText, tool as toolHelper } from 'ai'
import { z } from 'zod'
import * as todoist from '@/lib/todoist'
import * as calendar from '@/lib/google-calendar'

export const maxDuration = 60

// Bypass strict type checking for tool helper
const tool = toolHelper as any

// Initialize Venice provider using OpenAI compatibility
const venice = createOpenAI({
    apiKey: process.env.VENICE_API_KEY,
    baseURL: 'https://api.venice.ai/api/v1',
})

const AUTO_OPEN_MODEL_VALUE = '__venice_open_default__'
const AUTO_MODEL_VALUE = '__venice_default__'
const VENICE_API_BASE = 'https://api.venice.ai/api/v1'
const FALLBACK_MODEL = process.env.VENICE_MODEL || 'llama-3.3-70b'

type VeniceModel = {
    id: string
    type: string
    created?: number
    model_spec?: {
        modelSource?: string
        offline?: boolean
    }
}

async function resolveModelId(model?: string) {
    if (model && model !== AUTO_MODEL_VALUE && model !== AUTO_OPEN_MODEL_VALUE) {
        return model
    }

    try {
        const headers = {
            Authorization: `Bearer ${process.env.VENICE_API_KEY}`,
        }

        if (model === AUTO_OPEN_MODEL_VALUE || !model) {
            const [modelsResponse, traitsResponse] = await Promise.all([
                fetch(`${VENICE_API_BASE}/models?type=text`, {
                    headers,
                    next: { revalidate: 60 * 60 },
                }),
                fetch(`${VENICE_API_BASE}/models/traits?type=text`, {
                    headers,
                    next: { revalidate: 15 * 60 },
                }),
            ])

            if (!modelsResponse.ok) {
                throw new Error(`Venice models request failed: ${modelsResponse.status} ${modelsResponse.statusText}`)
            }

            const modelsPayload = await modelsResponse.json()
            const traitsPayload = traitsResponse.ok ? await traitsResponse.json() : { data: {} }
            const defaultModelId = typeof traitsPayload.data?.default === 'string' ? traitsPayload.data.default : null
            const availableModels: VeniceModel[] = Array.isArray(modelsPayload.data)
                ? modelsPayload.data.filter((item: VeniceModel) => item.type === 'text' && !item.model_spec?.offline)
                : []
            const defaultModel = availableModels.find((item) => item.id === defaultModelId)

            if (defaultModel?.model_spec?.modelSource) {
                return defaultModel.id
            }

            const newestOpenModel = availableModels
                .filter((item) => Boolean(item.model_spec?.modelSource))
                .sort((a, b) => (b.created || 0) - (a.created || 0))[0]

            return newestOpenModel?.id || defaultModelId || FALLBACK_MODEL
        }

        const response = await fetch(`${VENICE_API_BASE}/models/traits?type=text`, {
            headers,
            next: { revalidate: 15 * 60 },
        })

        if (!response.ok) {
            throw new Error(`Venice traits request failed: ${response.status} ${response.statusText}`)
        }

        const payload = await response.json()
        return typeof payload.data?.default === 'string' ? payload.data.default : FALLBACK_MODEL
    } catch (error) {
        console.error('Failed to resolve Venice model:', error)
        return FALLBACK_MODEL
    }
}

const SYSTEM_PROMPT = `You are a "Proactive Life Planner" AI assistant. Your goal is to help the user organizes their life using Todoist and Google Calendar.

You have access to the user's Todoist tasks/projects and Google Calendar events.

Your Core Philosophy:
1.  **Proactive**: Don't just wait for commands. Analyze the user's workload and schedule. identifying conflicts or overload.
2.  **Assistive**: If a user has a vague goal (e.g., "Plan my trip"), break it down into concrete subtasks in a dedicated project.
3.  **Organized**: Group loose tasks into projects with appropriate labels and priorities.

Tools Available:
- \`getTasks\`: Fetch tasks. Use filters like "today", "tomorrow", "priority 1".
- \`addTask\`: Create a task. ALWAYS try to set a due date, priority (4=Urgent, 1=Low), project, and duration (in minutes or days) if the user mentions how long something will take.
- \`updateTask\`: Modify tasks (content, date, priority, labels, duration). Pass \`duration: null\` to remove an existing duration.
- \`moveTask\`: Move a task to a different project.
- \`closeTask\`: Complete a task.
- \`getProjects\`: See available projects.
- \`addProject\`: Create a new project.
- \`fetchCalendarEvents\`: Check calendar availability.
- \`createCalendarEvent\`: basic calendar blocking.

When the user asks to "Plan my day":
1.  Fetch calendar events for today.
2.  Fetch active tasks for today (or high priority).
3.  Propose a time-blocked schedule that integrates both.

When the user has a complex goal (e.g., "I want to learn guitar", "Plan a trip"):
1.  Break it down into 3-5 disparate, actionable subtasks.
2.  Ask the user for confirmation to add them to a new project or as individual tasks.
3.  **IMPORTANT**: If the user says "Please do this now", you must execute the tool calls.
4.  **Step-by-Step Execution**:
    -   First, call 'addTask' for the parent task.
    -   The system will return the new task's ID.
    -   Then, call 'addTask' for each subtask, passing the 'parentId' you just received.
    -   Do not try to generate all IDs yourself. You must use the tool.

**STRICT TOOL USAGE**:
-   You MUST use the 'addTask' tool.
-   Do NOT output text like <function=...> or [addTask(...)].
-   Do NOT describe the function calls. JUST CALL THEM.

Always be concise, professional, and helpful.

**Interactive Suggestions**:
At the end of your response, if there are logical next steps, use the \`suggestActions\` tool to provide 3-4 short, actionable buttons for the user.
Examples:
- After summarizing tasks: "Reschedule low priority", "Plan my afternoon", "Focus on urgent".
- After a plan is made: "Execute plan", "Modify plan".
- If user is overwhelmed: "Defer all non-urgent", "Move to tomorrow".`

export async function POST(req: Request) {
    console.log('--- POST /api/chat received ---');

    if (!process.env.VENICE_API_KEY) {
        console.error('VENICE_API_KEY is missing');
        return new Response(JSON.stringify({ error: 'Configuration Error: VENICE_API_KEY missing' }), { status: 500 });
    }

    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${process.env.ACCESS_CODE}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    try {
        const { messages, model } = await req.json()
        console.log('Messages received:', messages.length);

        const modelId = await resolveModelId(model)
        console.log('Using model:', modelId)

        const result = streamText({
            model: venice(modelId),
            messages,
            system: SYSTEM_PROMPT,
            maxSteps: 5,
            tools: {
                getProjects: tool({
                    description: 'Get all Todoist projects.',
                    parameters: z.object({}),
                    execute: async () => {
                        console.log('Calling getProjects')
                        const res = await todoist.getProjects()
                        console.log('getProjects result:', res ? 'Success' : 'Empty')
                        return res
                    },
                }),
                addProject: tool({
                    description: 'Create a new project in Todoist.',
                    parameters: z.object({
                        name: z.string().describe('The name of the new project'),
                    }),
                    execute: async ({ name }: { name: string }) => {
                        console.log('Calling addProject', { name })
                        return await todoist.addProject(name)
                    },
                }),
                getTasks: tool({
                    description: 'Get active tasks from Todoist. Can filter by project, label, etc. using a filter string.',
                    parameters: z.object({
                        filter: z.string().optional().describe('Filter string, e.g., "today", "#Project", "@Label", "priority 1"'),
                    }),
                    execute: async ({ filter }: { filter?: string }) => {
                        console.log('Calling getTasks with filter:', filter)
                        const res = await todoist.getTasks(filter)
                        console.log('getTasks result count:', Array.isArray(res) ? res.length : 'Unknown')
                        return res
                    },
                }),
                addTask: tool({
                    description: 'Add a task to Todoist. To add a subtask, pass the parent task ID as `parentId`.',
                    parameters: z.object({
                        content: z.string().describe('The task content/title'),
                        description: z.string().optional().describe('Detailed description'),
                        dueString: z.string().optional().describe('Natural language due date, e.g., "today at 10am"'),
                        priority: z.number().optional().describe('Priority: 4 (Urgent) to 1 (Low)'),
                        projectId: z.string().optional().describe('The project ID to add the task to'),
                        sectionId: z.string().optional().describe('The section ID to add the task to'),
                        parentId: z.string().optional().describe('The ID of the parent task to create a subtask'),
                        labels: z.array(z.string()).optional().describe('List of label names'),
                        duration: z.object({
                            amount: z.number().int().positive().describe('Duration amount, e.g. 30, 90, 2'),
                            unit: z.enum(['minute', 'day']).describe('Duration unit: "minute" or "day"'),
                        }).optional().describe('How long the task will take, e.g. { amount: 90, unit: "minute" }'),
                    }),
                    execute: async (args: any) => {
                        console.log('Calling addTask', args)
                        return await todoist.addTask(args)
                    },
                }),
                addComment: tool({
                    description: 'Add a comment to a specific task. Use this to add notes or context.',
                    parameters: z.object({
                        taskId: z.string().describe('The ID of the task to add a comment to'),
                        content: z.string().describe('The comment content'),
                    }),
                    execute: async ({ taskId, content }: { taskId: string, content: string }) => {
                        console.log('Calling addComment', { taskId, content })
                        return await todoist.addComment({ taskId, content })
                    },
                }),
                updateTask: tool({
                    description: 'Update an existing task in Todoist.',
                    parameters: z.object({
                        id: z.string().describe('The ID of the task to update'),
                        content: z.string().optional(),
                        dueString: z.string().optional(),
                        priority: z.number().optional(),
                        labels: z.array(z.string()).optional(),
                        duration: z.object({
                            amount: z.number().int().positive(),
                            unit: z.enum(['minute', 'day']),
                        }).nullable().optional().describe('Set or update task duration. Pass null to remove existing duration.'),
                    }),
                    execute: async ({ id, ...args }: { id: string, [key: string]: any }) => todoist.updateTask(id, args),
                }),
                moveTask: tool({
                    description: 'Move a task to a different project.',
                    parameters: z.object({
                        id: z.string().describe('The ID of the task to move'),
                        projectId: z.string().describe('The target project ID'),
                    }),
                    execute: async ({ id, projectId }: { id: string; projectId: string }) => todoist.moveTask(id, projectId),
                }),
                closeTask: tool({
                    description: 'Complete/close a task in Todoist.',
                    parameters: z.object({
                        id: z.string().describe('The ID of the task to close'),
                    }),
                    execute: async ({ id }: { id: string }) => todoist.closeTask(id),
                }),
                fetchCalendarEvents: tool({
                    description: 'Get events from Google Calendar.',
                    parameters: z.object({
                        timeMin: z.string().optional().describe('ISO string for start time (default: now)'),
                        timeMax: z.string().optional().describe('ISO string for end time'),
                    }),
                    execute: async ({ timeMin, timeMax }: { timeMin?: string; timeMax?: string }) => {
                        console.log('Calling fetchCalendarEvents', { timeMin, timeMax })
                        return await calendar.getEvents(timeMin, timeMax)
                    },
                }),
                createCalendarEvent: tool({
                    description: 'Add a new event to Google Calendar.',
                    parameters: z.object({
                        summary: z.string().describe('Event title'),
                        start: z.string().describe('Start time (ISO string)'),
                        end: z.string().describe('End time (ISO string)'),
                    }),
                    execute: async ({ summary, start, end }: { summary: string; start: string; end: string }) => calendar.addEvent(summary, start, end),
                }),
                suggestActions: tool({
                    description: 'Suggest follow-up actions to the user based on the current context.',
                    parameters: z.object({
                        actions: z.array(z.object({
                            label: z.string().describe('Short button text, e.g., "Reschedule"'),
                            action: z.string().describe('The full text to send if clicked, e.g., "Reschedule all low priority tasks to tomorrow"'),
                            type: z.enum(['search', 'calendar', 'task', 'plan']).describe('Icon type hint'),
                        })).max(4),
                    }),
                    execute: async ({ actions }: { actions: any[] }) => {
                        console.log('Suggesting actions:', actions);
                        return { suggested: true, count: actions.length };
                    },
                }),
            },
            onFinish: (event) => {
                console.log('Stream finished. Usage:', event.usage);
                console.log('Finish reason:', event.finishReason);
                if (event.text) console.log('Response text:', event.text);
            },
            onError: (error) => {
                console.error('Stream error:', error);
            }
        })

        // @ts-ignore
        return result.toDataStreamResponse()
    } catch (error) {
        console.error('API Route Error:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}
