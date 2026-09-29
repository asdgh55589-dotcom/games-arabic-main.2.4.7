# MCP-AIVEN Integration Guide

> Official server: [aiven-open/mcp-aiven](https://github.com/aiven-open/mcp-aiven) (`mcp-aiven@1.16.0`, installed globally via `npm install -g mcp-aiven`, Node 18+).
> This project uses it **read-only + PostgreSQL-scoped** — see `.mcp.json`.

## Setup

### 1. Install

```bash
npm install -g mcp-aiven
mcp-aiven --version
```

### 2. Create an Aiven API token

Console → profile → tokens: https://console.aiven.io/profile/tokens

Export it in your shell (never commit it):

```bash
export AIVEN_TOKEN="aiven-token-here"
```

### 3. Client configuration

**Claude Code / Cursor / VS Code** — `.mcp.json` in the project root (already committed, secrets via env only):

```json
{
  "mcpServers": {
    "aiven": {
      "command": "mcp-aiven",
      "args": [],
      "env": {
        "AIVEN_TOKEN": "${AIVEN_TOKEN}",
        "AIVEN_READ_ONLY": "true",
        "AIVEN_SERVICES_SCOPE": "pg"
      }
    }
  }
}
```

Claude Code one-liner equivalent:

```bash
claude mcp add --scope user aiven-mcp -e AIVEN_TOKEN="$AIVEN_TOKEN" -e AIVEN_READ_ONLY=true -e AIVEN_SERVICES_SCOPE=pg -- mcp-aiven
```

**OpenCode** (this repo also has `opencode.json`) — mirror the same server there:

```json
{
  "mcp": {
    "aiven": {
      "type": "local",
      "command": ["mcp-aiven"],
      "environment": {
        "AIVEN_TOKEN": "{env:AIVEN_TOKEN}",
        "AIVEN_READ_ONLY": "true",
        "AIVEN_SERVICES_SCOPE": "pg"
      },
      "enabled": true
    }
  }
}
```

**No-token alternative (hosted, OAuth):** point the client at `https://mcp.aiven.live/mcp?services_scope=pg&read_only=true` — the client authorizes via browser, no `AIVEN_TOKEN` needed.

### 4. Verify

```bash
# Server refuses to boot without a token (fail-closed — expected):
AIVEN_TOKEN="$AIVEN_TOKEN" timeout 10 mcp-aiven < /dev/null; echo "EXIT:$?"
```

Then restart the MCP client — the `aiven_*` tools appear automatically.

## Available Tools (read-only surface with our config)

With `AIVEN_READ_ONLY=true` + `AIVEN_SERVICES_SCOPE=pg`, only these are exposed (`core` is always included):

| Tool | Description |
|---|---|
| `aiven_project_list` / `aiven_project_get` | List / inspect projects |
| `aiven_service_list` / `aiven_service_get` | List / inspect services |
| `aiven_list_project_clouds` | Cloud platforms for a project |
| `aiven_service_metrics_fetch` | Service metrics (CPU, disk, connections) |
| `aiven_project_get_service_logs` | Recent service log entries |
| `aiven_project_get_event_logs` | Project event log |
| `aiven_service_query_activity` | Currently running queries |
| `aiven_pg_service_query_statistics` | Query statistics (slow-query hunting) |
| `aiven_pg_service_available_extensions` | Available PG extensions |
| `aiven_pg_read` | **Run a read-only SQL query** |
| `aiven_pg_optimize_query` | AI-powered query optimization (EverSQL) |

Excluded by design: `aiven_pg_write`, `aiven_service_create/update`, bouncer create/update/delete, Kafka producers, application deploys.
`aiven_service_connection_info` returns `[REDACTED]` unless `AIVEN_ALLOW_SECRETS=true` (keep it `false`).

## Example Use Cases

```sql
-- Pool pressure (Aiven pool = 5, must stay low)
SELECT count(*) AS active, state FROM pg_stat_activity GROUP BY state;

-- Slow queries (needs pg_stat_statements)
SELECT query, calls, round(total_exec_time::numeric,1) AS total_ms
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;

-- Table sizes (add LIMIT on large schemas)
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables WHERE schemaname = 'public' ORDER BY 3 DESC LIMIT 20;

-- Index health
SELECT schemaname, tablename, indexname
FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1, 2;
```

Run these via the `aiven_pg_read` tool (service + database as arguments) — not via `psql` with a pasted URI.

## Safety Guidelines

- **Read-only queries only** — `AIVEN_READ_ONLY=true` enforces this at the tool level. Never flip it off without owner sign-off.
- **Schema changes go through Prisma migrations** (`bun run db:migrate`), never through MCP — not even if a write tool is visible.
- **Always use `LIMIT`** on large tables; add `statement_timeout` for exploratory queries (project default: 15s).
- **Never run DROP / DELETE / UPDATE / DDL through MCP.**
- **Never expose credentials**: `AIVEN_ALLOW_SECRETS` stays `false`; connection URIs stay `[REDACTED]`; tokens live in env, never in `.mcp.json`, docs, logs, or prompts.
- **Do not bypass `src/lib/db.ts`** — the app runtime singleton (pool 5/10s/15s, `sslmode=require`) remains the only production data path; MCP is an inspection side-channel.
- **Review agent actions** in production (upstream warning): the server acts with your Aiven user permissions.

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `Fatal error: AIVEN_TOKEN environment variable is required` | Token not exported — `export AIVEN_TOKEN=...` then restart client |
| Tools list is empty after restart | Client didn't pick up `.mcp.json` — restart the client session fully |
| Write tools visible | `AIVEN_READ_ONLY` not set to `true` — check client env passthrough |
| Non-PG tools visible | `AIVEN_SERVICES_SCOPE` not set to `pg` |
| Connection `[REDACTED]` | Expected — `AIVEN_ALLOW_SECRETS` defaults to `false`, keep it that way |
