# Product Requirements Document: Todoist Agent

## 1. Product Vision
**Goal**: Create an AI-powered "Proactive Life Planner" agent that acts as the prompt, intelligent organizer of the user's life.
**Core Philosophy**:
- **Proactive**: Don't just wait for commands. Suggest schedules, reprioritize tasks, and identify conflicts.
- **Assistive**: Help break down overwhelming tasks into manageable subtasks.
- **Organized**: Automatically group loose tasks into projects and provide structure.

## 2. Target Audience
- Professional users who want to leverage the full power of Todoist features (Labels, Projects, Sections, Priorities) via a natural language interface.
- People who need help organizing their schedule across tasks and calendar events.

## 3. Core Features (MVP)
### 3.1 Proactive Chat Interface
- **Context Awareness**: Logic to analyze current tasks + calendar events to provide "Start of Day" or "Plan Adjustment" suggestions.
- **Task Breakdown**: Capability to take a complex request (e.g., "Plan my trip to Japan") and generate a hierarchical project/task structure in Todoist.

### 3.2 Deep Todoist Integration
The agent will have full capability to manipulate Todoist entities:
- **Smart task creation**: `add_task` with NLP (dates, labels, priorities).
- **Project Management**: `create_project`, `move_task` to organize workspaces.
- **Task Enrichment**: `add_subtask`, `update_priority`, `add_label`.
- **Querying**: Filtering tasks to answer "What's high priority today?".

### 3.3 Calendar Integration (Google)
- **Read-Only Availability**: Fetch upcoming events to inform task scheduling.
- **Conflict Detection**: Warn the user if they try to schedule too many tasks on a busy day.
- **Calendar Blocking**: Create explicit Google Calendar time blocks when the user confirms a schedule.

## 4. Technical Stack
- **Frontend**: Next.js (Already set up), TailwindCSS, Shadcn/UI
- **AI Engine**: **Venice.ai** (via OpenAI-compatible API endpoint).
- **Tooling**: Vercel AI SDK (Core + React).
- **Integrations**:
    - `todoist-api-typescript` (Official SDK)
    - Google Calendar API (Read-only via API Key/Service Account or potential generic read).
- **Auth**: Personal Usage (API Keys in `.env.local`).

## 5. Success Metrics
- User can plan their entire day via a single conversation.
- Complex tasks are successfully broken down into subtasks in Todoist.
- No need to open the Todoist UI for daily planning.
