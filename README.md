# Todoist Agent

An AI-powered **Proactive Life Planner** that lets you manage your Todoist tasks and Google Calendar through natural language conversation. Instead of navigating multiple apps, you chat with an AI agent that reads, creates, and organizes your tasks and calendar events on your behalf.

## What it does

The agent acts as an intelligent productivity assistant with three core behaviors:

- **Proactive**: Analyzes your current workload and schedule, surfaces conflicts, and suggests reprioritization without waiting to be asked.
- **Assistive**: Breaks down vague goals (e.g., "Plan my trip to Japan") into hierarchical Todoist projects with concrete subtasks.
- **Organized**: Groups loose tasks into projects, applies labels, sets priorities, and blocks time on your calendar.

### Agent capabilities

The AI has tool access to:

| Tool | Description |
|------|-------------|
| `getTasks` | Fetch active tasks with Todoist filter syntax (`today`, `priority 1`, `#Project`, etc.) |
| `addTask` | Create tasks with due date, priority, project, section, labels, duration, and parent (for subtasks) |
| `updateTask` | Modify any task field including duration (pass `null` to clear it) |
| `moveTask` | Move a task to a different project |
| `closeTask` | Complete a task |
| `getProjects` | List all Todoist projects |
| `addProject` | Create a new project |
| `addComment` | Attach a note to an existing task |
| `fetchCalendarEvents` | Read upcoming Google Calendar events for scheduling context |
| `createCalendarEvent` | Add a time-block to Google Calendar |
| `suggestActions` | Surface 3–4 contextual quick-action buttons after each response |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, TailwindCSS v4, Shadcn/UI |
| AI SDK | Vercel AI SDK (`streamText` with multi-step tool calls) |
| AI Provider | [Venice.ai](https://venice.ai) via OpenAI-compatible API |
| Todoist | `@doist/todoist-api-typescript` v6 |
| Calendar | Google Calendar API v3 via `googleapis` |
| PWA | `@ducanh2912/next-pwa` |

## Features

- **Streaming chat** with full Markdown + GFM table rendering
- **Live Venice model selector** — fetches the current model catalog on load, auto-refreshes hourly; falls back to `llama-3.3-70b` if unavailable
- **Persisted chat history** — up to 20 threads (80 messages each) stored in `localStorage`, keyed per access code
- **Proactive day planning** — ask "Plan my day" and the agent fetches both your tasks and calendar events, then proposes a time-blocked schedule
- **Task duration support** — specify how long a task will take in minutes or days
- **PWA shortcuts** — installable on mobile/desktop with home-screen shortcuts for "Plan my day" and "Add task"
- **Dark / light mode**
- **Access code auth** — a simple shared secret protects the API route; intended for personal or small-team use

## Getting started

### Prerequisites

- Node.js 18+
- A [Venice.ai](https://venice.ai) API key
- A [Todoist](https://todoist.com) API token
- A Google Cloud service account with Calendar API access (optional — the agent degrades gracefully if credentials are absent)

### Environment variables

Create a `.env.local` file at the project root:

```env
# Required
VENICE_API_KEY=your_venice_api_key
TODOIST_API_TOKEN=your_todoist_api_token
ACCESS_CODE=your_chosen_access_code

# Optional — defaults to llama-3.3-70b if VENICE_API_KEY resolves no model
VENICE_MODEL=llama-3.3-70b

# Optional — Google Calendar integration
GOOGLE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=primary
```

### Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter your `ACCESS_CODE`, and start chatting.

### Build for production

```bash
npm run build
npm start
```

Deploy to any Node.js host (Vercel, Railway, Fly.io, etc.). Set the environment variables in your hosting provider's dashboard.

## Project structure

```
src/
  app/
    api/
      chat/route.ts          # Streaming AI endpoint — tool definitions & system prompt
      venice-models/route.ts # Proxied Venice model catalog for the frontend
    layout.tsx               # App shell, metadata, PWA config
    page.tsx                 # Root page
    offline/page.tsx         # PWA offline fallback
  components/
    chat.tsx                 # Full chat UI — history, model selector, suggestions
    auth-wall.tsx            # Access code gate
    mode-toggle.tsx          # Dark/light theme switcher
  lib/
    todoist.ts               # Todoist API wrapper
    google-calendar.ts       # Google Calendar API wrapper
public/
  manifest.json              # PWA manifest with shortcuts
```
