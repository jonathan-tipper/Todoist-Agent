
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, tool as toolHelper } from 'ai';
import { z } from 'zod';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load env
config({ path: resolve(process.cwd(), '.env.local') });

if (!process.env.VENICE_API_KEY) {
    console.error('VENICE_API_KEY is missing');
    process.exit(1);
}

const venice = createOpenAI({
    apiKey: process.env.VENICE_API_KEY,
    baseURL: 'https://api.venice.ai/api/v1',
});

// Mock tool helper to avoid type errors
const tool = toolHelper as any;

const SYSTEM_PROMPT = `You are a "Proactive Life Planner" AI assistant. Your goal is to help the user organizes their life using Todoist and Google Calendar.

You have access to the user's Todoist tasks/projects and Google Calendar events.

Your Core Philosophy:
1.  **Proactive**: Don't just wait for commands. Analyze the user's workload and schedule. identifying conflicts or overload.
2.  **Assistive**: If a user has a vague goal (e.g., "Plan my trip"), break it down into concrete subtasks in a dedicated project.
3.  **Organized**: Group loose tasks into projects with appropriate labels and priorities.

Tools Available:
- 'getTasks': Fetch tasks. Use filters like "today", "tomorrow", "priority 1".
- 'addTask': Create a task. ALWAYS try to set a due date, priority (4=Urgent, 1=Low), and project if possible.
- 'updateTask': Modify tasks (content, date, priority, labels).
- 'moveTask': Move a task to a different project.
- 'closeTask': Complete a task.
- 'getProjects': See available projects.
- 'fetchCalendarEvents': Check calendar availability.
- 'createCalendarEvent': basic calendar blocking.
- 'addComment': Add comments to tasks.

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

Always be concise, professional, and helpful.`;

async function run() {
    console.log('Testing Task Breakdown Logic... (Retry with Step-by-Step instruction)');

    try {
        const { text, toolCalls, steps: _steps } = await generateText({
            model: venice('llama-3.3-70b'),
            system: SYSTEM_PROMPT,
            messages: [
                { role: 'user', content: "I want to learn guitar. Create a main task 'Learn Guitar' and 3 subtasks for it: 'Buy Guitar', 'Find Teacher', 'Practice Scales'. Please execute this using the tools." }
            ],
            maxSteps: 10, // Allow more steps for sequential calls
            tools: {
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
                    }),
                    execute: async (args: any) => {
                        console.log('--- EXECUTE addTask ---');
                        console.log(JSON.stringify(args, null, 2));
                        // Return a simulated ID
                        const id = 'task_' + Math.floor(Math.random() * 10000);
                        return { id, content: args.content };
                    },
                }),
                // Mock other tools just in case
                getProjects: tool({
                    description: 'Get all Todoist projects.',
                    parameters: z.object({}),
                    execute: async () => []
                })
            },
        });

        console.log('\n--- Final Response ---');
        console.log(text);

        console.log('\n--- Tool Call History ---');
        // toolCalls includes all calls from all steps
        toolCalls.forEach((tc, i) => {
            console.log(`${i + 1}. ${tc.toolName}(${JSON.stringify(tc.args)})`);
        });

        // Verification Logic
        const addCalls = toolCalls.filter(tc => tc.toolName === 'addTask');
        if (addCalls.length === 0) throw new Error('No tasks created');

        const parentTask = addCalls.find(tc => !tc.args.parentId && tc.args.content.includes('Learn Guitar'));
        if (!parentTask) console.warn('Warning: Could not identify clear parent task');

        const subtasks = addCalls.filter(tc => tc.args.parentId);
        console.log(`\nCreated ${addCalls.length} tasks total.`);
        console.log(`Parent tasks: ${addCalls.length - subtasks.length}`);
        console.log(`Subtasks: ${subtasks.length}`);

        if (subtasks.length >= 3) {
            console.log('SUCCESS: Verified creation of 3+ subtasks linked to a parent.');
        } else {
            console.error('FAILURE: Expected 3 subtasks, found ' + subtasks.length);
            process.exit(1);
        }

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

run();
