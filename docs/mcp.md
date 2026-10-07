# Sosial MCP

AI agents (Claude, Cursor, or any MCP-compatible client) can operate a Sosial
workspace through the Model Context Protocol: create and edit posts, schedule
and unschedule, list channels and media, and read the queue — with the same
validation, plan limits and approval rules as the web app.

- Endpoint: `https://sosial.app/api/mcp`
- Transport: MCP Streamable HTTP, **stateless** (JSON responses, no session)
- Auth: workspace API key as `Authorization: Bearer <key>`

## Auth model (and why)

Sosial reuses its existing API-key system instead of running a full OAuth
authorization server. Keys are: generated per client, **shown once**, stored
as SHA-256 hashes, scoped, revocable, expiry-capable, and workspace-bound —
the same credential model Zapier already uses. Every request resolves to one
workspace + the key creator's user; nothing trusts IDs from tool arguments.

Create a scoped key in **Team → AI & Developer — MCP** with a permission
checklist (delete posts is off by default).

## Scopes

| Scope | Allows |
|---|---|
| `posts:read` | get_post, get_scheduled_posts |
| `posts:write` | create_post (drafts), update_post |
| `posts:schedule` | schedule_post, unschedule_post (implies posts:write) |
| `posts:delete` | delete_post (off by default) |
| `channels:read` | get_channels, get_channel_status |
| `media:read` | get_media |
| `analytics:read` | reserved — not yet registered |

Missing scope → `{"success":false,"error_code":"insufficient_scope",...}`.

## Tools

| Tool | Notes |
|---|---|
| `create_post` | `content`, `channel_ids`, optional `title`, `media_ids`*, `scheduled_at`, `timezone`, `idempotency_key`. Without `scheduled_at` → draft. |
| `update_post` | Edit title/content/time of a draft or queued post. Editing a post due within 30 min requires confirmation. |
| `schedule_post` | ISO 8601 time ≥ 5 minutes out; returns resolved UTC + local. |
| `unschedule_post` | Queued → draft (confirmation required). |
| `delete_post` | Confirmation required. |
| `get_post` | Status, per-channel targets, media summary. No credentials. |
| `get_scheduled_posts` | Window + channel filters, page size ≤ 50, cursor pagination. |
| `get_channels` / `get_channel_status` | Connected channels only; never tokens. |
| `get_media` | Uploaded media metadata. |

\* `media_ids` is validated but not yet attachable (planned).

## Confirmation model (anti-footgun)

Destructive or externally-visible calls return
`{"success":false,"error_code":"confirmation_required","confirmation_token":"…","summary":"…","expires_in":300}`.
Re-calling with the same arguments plus `confirm: <token>` executes. Tokens
are single-use, 5-minute TTL, bound to workspace + key + tool + exact
arguments (argument changes invalidate the token).

## Idempotency

`create_post` accepts `idempotency_key` — a repeated key returns the original
post instead of creating a duplicate (enforced by the `posts.client_id`
unique constraint, namespaced per key).

## Rate limits

Per key, per minute: 20 writes / 60 reads (in-process counters). Exceeding
returns `rate_limited` with retry seconds.

## Example client config (Claude Desktop / Cursor-style)

```json
{
  "mcpServers": {
    "sosial": {
      "type": "http",
      "url": "https://sosial.app/api/mcp",
      "headers": { "Authorization": "Bearer sos_live_xxxxxxxxxxxx" }
    }
  }
}
```

## Example prompts

- "What's scheduled on my Sosial for the next 7 days?"
- "Draft a LinkedIn post announcing our webinar, keep it under 2000 characters."
- "Schedule that draft for Tuesday 9am Europe/Berlin." (agent will echo the
  resolved UTC + local time back for confirmation)

## Security model

- `user_id` / `workspace_id` resolved server-side from the key; tool
  arguments can never widen access (every query is workspace-equality bound).
- Tokens are hashed at rest; never returned by any API, never logged.
- Confirmation tokens are hashed, single-use, 5-minute TTL.
- Every tool call is logged (`mcp_logs`: tool, outcome, latency — no content).
- Errors return stable codes (`unauthenticated`, `insufficient_scope`,
  `not_found`, `validation_failed`, `channel_not_connected`,
  `scheduled_in_past`, `confirmation_required`, `rate_limited`,
  `internal_error`); stack traces never reach clients.

## Local development

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (existing web env) — no new env vars. Run
`npm run dev` in `apps/web` and point the client at
`http://localhost:3000/api/mcp`.

## Operational notes

- Stateless transport: one fresh transport per request; safe for serverless.
- `mcp_confirmations` rows are consumed on use; stale rows are harmless
  (5-minute TTL checked on redemption).
- Revoke a client by revoking its key (Team → API keys) — in-flight calls
  fail closed immediately.
