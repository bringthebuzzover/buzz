# Buzz admin MCP

Local **stdio** MCP for operator agents. Talks to `/api/admin/*` (default
production API). Credentials stay in **user** Cursor MCP config — never commit
them ([`AGENTS.md`](../../AGENTS.md)).

Column policy: [`ideas/archive/admin-mcp.md`](../../ideas/archive/admin-mcp.md).

## Setup

```bash
cd tools/buzz-admin-mcp
poetry install
```

User `~/.cursor/mcp.json` (do not add this file to the repo):

```json
{
  "mcpServers": {
    "buzz-admin": {
      "command": "poetry",
      "args": ["run", "buzz-admin-mcp"],
      "cwd": "/ABS/PATH/TO/buzz/tools/buzz-admin-mcp",
      "env": {
        "BUZZ_ADMIN_EMAIL": "you@bringthebuzzover.com",
        "BUZZ_ADMIN_PASSWORD": "…"
      }
    }
  }
}
```

`BUZZ_API_URL` defaults to `https://api.bringthebuzzover.com`. Override for
local (`http://localhost:8000`). Optional `BUZZ_ADMIN_ACCESS_TOKEN` skips login.

Mutations need explicit user OK — same bar as Railway / Resend MCP.
