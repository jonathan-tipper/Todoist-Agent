# Todoist API Scope Reference

Todoist's current public API target is API v1 at:

```text
https://api.todoist.com/api/v1
```

Use Bearer authentication for every resource:

```text
Authorization: Bearer <token>
```

For personal use, a personal API token is enough. For other users, use Todoist OAuth and request only the needed scopes.

## Preferred Access Paths

- Use hosted Todoist MCP at `https://ai.todoist.net/mcp` for natural assistant workflows in Hermes.
- Use API v1 REST endpoints for direct resource calls.
- Use `/sync` for incremental sync, batch writes, temporary IDs, and command idempotency.
- Avoid the older `/rest/v2` endpoint family for new work.

## OAuth Scopes

Request the least scope that satisfies the task:

- `task:add`: add tasks only.
- `data:read`: read tasks, projects, labels, filters, and related application data.
- `data:read_write`: read/write application data.
- `data:delete`: delete tasks, labels, filters, and similar application data.
- `project:delete`: delete projects.
- `backups:read`: list backups with `GET /api/v1/backups`; downloading a backup still needs `data:read_write`.

Personal API tokens can be used for personal automation, but treat them as high-trust credentials.

## Endpoint Families

Use the official API docs for exact request fields. This reference is a map for choosing the right area:

- Sync: `/sync` for full and incremental sync, command batching, temp ID mapping, and idempotent write commands.
- User and settings: current user, user settings, plan limits, productivity stats.
- Tasks/items: create, list/filter, get, update, close/reopen, move, delete, durations, priorities, due dates, deadlines, assignments.
- Projects: create, list, get, update, archive/unarchive, delete, collaborators, comments, sharing and permissions.
- Sections: create, list, get, update, archive/unarchive, delete, move.
- Labels: personal and shared labels, create/list/get/update/delete.
- Comments/notes: list, create, get, update, delete; task and project comments; attachments.
- Reminders: absolute, relative, and location reminders where the account plan supports them.
- Filters: create, list, get, update, delete.
- Activities: activity log with cursor pagination and filters.
- Backups: list and download backup archives; may require MFA or plan support.
- Uploads: create/delete uploaded files and use returned attachment metadata with comments.
- Emails: get/create or disable email-to-Todoist addresses for supported objects.
- Webhooks: app-level webhook configuration and event handling. For personal use, OAuth completion may be needed before events fire.
- Workspaces/teams: workspace projects, roles, permissions, collaborators, logo, and notification settings where available.
- Templates: project template import/export where exposed by the API.
- ID mapping: translate IDs between old API versions and API v1 where needed for migrations.
- Billing: subscription-related endpoints for app contexts that are authorized to use them.

## Pagination

Cursor-paginated endpoints return a `results` array and `next_cursor`. Use `limit` values up to 200. Continue fetching until `next_cursor` is absent or null.

The helper supports:

```bash
python3 scripts/todoist_api.py request GET /tasks --all-pages --query limit=200
python3 scripts/todoist_api.py request GET /tasks/filter --query query=today --all-pages
```

In API v1, `GET /tasks` no longer accepts the old `filter` parameter. Use `GET /tasks/filter` with the `query` parameter for Todoist filter syntax such as `today`, `overdue`, or `#Work & p1`.

## Sync Commands

When writing through `/sync`:

- Generate a unique `uuid` per command.
- Reuse the same `uuid` only for a safe retry of the same command.
- Use `temp_id` for newly created resources that later commands in the same batch need to reference.
- Do not send more than 100 commands in one request.

## Limits And Backoff

- Standard requests can time out after 15 seconds.
- Upload processing can take longer.
- Sync limits differ for full and partial sync. Prefer full sync once, then incremental sync.
- API errors can include `error_extra.retry_after`; respect it before retrying.
- POST bodies are limited to 1 MiB, excluding plan-dependent upload limits.

## Assistant Safety Checklist

Before mutating Todoist:

1. Identify exact target IDs from fresh API/MCP data.
2. Confirm ambiguous task names with the user.
3. Summarize destructive effects before deletes, archive operations, bulk moves, and batch completions.
4. Prefer a dry run for broad edits.
5. Report what changed and include returned IDs or URLs when useful.
