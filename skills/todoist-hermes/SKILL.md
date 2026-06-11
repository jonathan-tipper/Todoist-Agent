---
name: todoist-hermes
description: Manage Todoist from Hermes using the official Todoist MCP server when configured, with a REST/Sync API fallback helper for full Todoist API v1 coverage.
version: 1.0.0
author: Todoist-Agent
platforms: [linux, macos]
prerequisites:
  commands: [python3]
metadata:
  hermes:
    category: productivity
    tags: [todoist, tasks, productivity, mcp, api]
    config:
      - key: todoist.api_token
        description: "Todoist personal API token or OAuth access token for REST/Sync API fallback calls."
        prompt: "Enter your Todoist API token"
        url: "https://app.todoist.com/app/settings/integrations/developer"
      - key: todoist.mcp_enabled
        description: "Whether Hermes should prefer the hosted Todoist MCP server for normal task and project operations."
        prompt: "Use the hosted Todoist MCP server when available? true/false"
      - key: todoist.default_limit
        description: "Default page size for Todoist paginated API calls. Todoist accepts up to 200."
        prompt: "Default Todoist API page size"
---

# Todoist Hermes

Use this skill when the user wants Hermes to act as their Todoist assistant: capture tasks, plan days, organize projects, inspect workload, update or complete tasks, manage labels/sections/comments/reminders, read activity, use backups or email-to-Todoist endpoints, or call any current Todoist API v1 endpoint.

This skill is not created by, affiliated with, or supported by Doist.

## Setup

Prefer the official hosted Todoist MCP server for ordinary assistant workflows because it gives Hermes native task/project tools through MCP OAuth.

Add this to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  todoist:
    url: "https://ai.todoist.net/mcp"
    auth: oauth
    enabled: true
    timeout: 120
    tools:
      resources: false
      prompts: false
```

Then restart Hermes or run `/reload-mcp`. On first connection, complete the browser OAuth flow. Todoist MCP tools will appear with the `mcp_todoist_` prefix.

For full API v1 coverage, also configure a Todoist token for the helper script. Store secrets in Hermes, not in this skill:

```bash
hermes config set TODOIST_API_TOKEN "<token>"
hermes config set TODOIST_DEFAULT_LIMIT "100"
```

If Hermes exposes skill config values instead of environment variables in your instance, copy `skills.config.todoist-hermes.todoist.api_token` into `TODOIST_API_TOKEN` before running the helper.

## Operating Model

1. Establish intent and safety.
   - Read-only requests can run without extra confirmation.
   - Any create, update, complete, archive, unarchive, move, upload, email-enable, reminder change, or delete must match a clear user request.
   - Before destructive operations, summarize the target objects and wait for user confirmation.
2. Use Todoist MCP tools first when they are available and cover the task.
3. Use `scripts/todoist_api.py` for API v1 endpoints or Sync commands that MCP does not expose, for pagination, or for raw debugging.
4. Prefer structured API responses over Todoist UI scraping.
5. Never print, summarize, or store API tokens in conversation output or generated files.
6. Watch for `tmp-` IDs from Todoist clients. They are client placeholders, not valid REST IDs. Ask the user to wait for sync or use `/sync` data to map them.

## API Helper

Load `references/todoist-api-scope.md` before using a less common endpoint. Load `references/spec.md` when changing this skill.

Basic read:

```bash
python3 ~/.hermes/skills/productivity/todoist-hermes/scripts/todoist_api.py request GET /tasks/filter --query query=today --all-pages
```

Create or update after the user explicitly asks for it:

```bash
python3 ~/.hermes/skills/productivity/todoist-hermes/scripts/todoist_api.py request POST /tasks --json '{"content":"Book dentist","due_string":"tomorrow"}' --yes
```

Sync read:

```bash
python3 ~/.hermes/skills/productivity/todoist-hermes/scripts/todoist_api.py sync --resource-types '["items","projects","sections","labels"]'
```

Sync batch write after confirmation:

```bash
python3 ~/.hermes/skills/productivity/todoist-hermes/scripts/todoist_api.py sync --commands '[{"type":"item_complete","uuid":"00000000-0000-4000-8000-000000000001","args":{"id":"TASK_ID"}}]' --yes
```

Dry run a write:

```bash
python3 ~/.hermes/skills/productivity/todoist-hermes/scripts/todoist_api.py request DELETE /tasks/TASK_ID --dry-run
```

## Assistant Behavior

When planning with Todoist:

- Inspect projects, sections, labels, due dates, priorities, durations, and calendar-like constraints before moving tasks around.
- For vague goals, propose a short project/task breakdown first. Create it only after the user agrees.
- Use Todoist priority values carefully. Check the current endpoint docs and returned task data instead of assuming the UI `p1` label maps directly to API value `1`.
- Preserve user wording for task content unless the user asks you to rewrite it.
- Use labels and sections for organization only when they already exist or when the user approves creating them.
- For recurring tasks, explain whether the operation changes the next occurrence or the recurring rule before acting.

## Verification

After setup, verify the MCP path:

```text
Tell me which MCP-backed Todoist tools are available.
```

Verify the fallback path without changing data:

```bash
python3 ~/.hermes/skills/productivity/todoist-hermes/scripts/todoist_api.py doctor
python3 ~/.hermes/skills/productivity/todoist-hermes/scripts/todoist_api.py request GET /tasks --query limit=1
```

If a call fails, inspect the JSON error. Todoist responses can include `error_tag`, `error_code`, `http_code`, and `error_extra.retry_after`.

## Pitfalls

- Todoist API v1 is the current target. Do not default to the older `/rest/v2` API.
- Do not assume every Todoist account has all features. Some reminders, backups, teams, uploads, and collaborators depend on plan and permissions.
- Do not parse the human-readable summary from MCP responses when structured content is available.
- Do not disable TLS verification for Todoist MCP or API calls.
