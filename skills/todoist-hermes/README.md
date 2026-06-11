# Todoist Hermes Skill

Installable Hermes skill for managing Todoist through the official Todoist MCP server plus a local Todoist API v1 helper.

## Local Install

```bash
mkdir -p ~/.hermes/skills/productivity
cp -R skills/todoist-hermes ~/.hermes/skills/productivity/todoist-hermes
```

Start a new Hermes session or reset the current one, then use:

```text
/todoist-hermes
```

## Configure

Add the MCP server from `templates/hermes-config.yaml` to `~/.hermes/config.yaml`, then run `/reload-mcp` or restart Hermes.

For REST/Sync fallback:

```bash
hermes config set TODOIST_API_TOKEN "<token>"
hermes config set TODOIST_DEFAULT_LIMIT "100"
```

## Verify

```bash
python3 ~/.hermes/skills/productivity/todoist-hermes/scripts/todoist_api.py doctor
```
