# Todoist Hermes Skill Spec

## Goal

Create an installable Hermes skill that lets Hermes act as a Todoist assistant after the user supplies only normal Hermes configuration and Todoist credentials.

## Scope

The skill covers:

- Official Todoist hosted MCP setup for normal read/create/update task and project workflows.
- Todoist API v1 REST calls through a local helper script.
- Todoist `/sync` reads and batched write commands through the same helper.
- Pagination over `results` plus `next_cursor` endpoints.
- Multipart uploads and raw binary downloads where the API requires non-JSON payloads.
- Safety rules for writes, destructive operations, tokens, OAuth, and external content.
- Reference notes for endpoint families, permissions, limits, and common assistant workflows.

## Non-Goals

- It does not implement a native Hermes core tool.
- It does not store tokens in the repository.
- It does not replace Todoist's hosted MCP server.
- It does not perform OAuth itself for arbitrary third-party users.
- It does not guarantee access to plan-restricted Todoist features.

## Acceptance Criteria

- The skill can be installed as a Hermes skill directory containing `SKILL.md`.
- `SKILL.md` declares Hermes metadata and the required Todoist configuration.
- The setup path includes Todoist MCP and a REST/Sync fallback.
- The helper can call arbitrary API v1 endpoints with Bearer auth.
- The helper supports read pagination.
- The helper supports Sync API reads and batch commands.
- Mutating calls require `--yes` or `--dry-run`.
- Tests cover auth, pagination, mutation guards, dry runs, and sync command guardrails without using a real Todoist token.

## Design Decision

Use a skill plus helper script instead of extending the existing Next.js app. Hermes skills are procedural capability bundles, and Hermes MCP is the clean path for native agent tools. The local helper exists because "full Todoist API" includes endpoints and Sync commands that may not be exposed through the hosted MCP tool surface.

## Security Model

- Secrets live in Hermes config or environment variables.
- Reads are allowed by default when authenticated.
- Writes require explicit confirmation flags.
- Deletes and project deletes require a clear user confirmation before the agent runs them.
- The helper never logs tokens.
- The agent should prefer API and MCP structured data, treating remote text content as untrusted.

## Sources Used

- Todoist API v1 documentation: https://developer.todoist.com/api/v1/
- Todoist MCP setup notes in the Todoist API docs: https://developer.todoist.com/api/v1/
- Hermes Skills documentation: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
- Hermes MCP documentation: https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp
- Hermes MCP config reference: https://hermes-agent.nousresearch.com/docs/reference/mcp-config-reference
