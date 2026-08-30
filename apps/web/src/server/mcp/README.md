# Kanbi MCP server

Kanbi's [Model Context Protocol](https://modelcontextprotocol.io) server turns a
finished agent discussion into reviewed Kanbi tasks. It captures approved work;
it does not manage tasks after creation.

- **Endpoint:** `https://<your-kanbi-host>/api/mcp` (Streamable HTTP). In local
  dev that is `http://kanbi.localhost:3333/api/mcp`.
- **Auth:** OAuth 2.1 with a browser consent screen. The agent registers itself
  (RFC 7591 Dynamic Client Registration), you log in once and approve, and it
  receives a JWT access token. There are no API keys to copy or paste.
- **Authorization:** `kanbi:read` and `kanbi:write` are checked against the
  live OAuth consent on every MCP request. Revoking an app takes effect
  immediately, even for an unexpired JWT.

Everything below uses `kanbi.localhost:3333` as the example host. Swap in your
own deployment origin in production.

## Connect an agent

### Claude Code

```bash
claude mcp add --transport http kanbi http://kanbi.localhost:3333/api/mcp
```

Then run any Kanbi tool (or `/mcp` in the TUI) and Claude opens the browser
consent flow. After you approve, the tools are available.

### Codex

Add the remote Streamable HTTP server, then complete the OAuth login:

```bash
codex mcp add kanbi --url http://kanbi.localhost:3333/api/mcp
codex mcp login kanbi
```

Codex shares this MCP configuration across its CLI, desktop app, and IDE
extension. Use `/mcp` in the Codex TUI to inspect connected servers.

### opencode

Add the server to `opencode.json` (project root) or
`~/.config/opencode/opencode.json` (global):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "kanbi": {
      "type": "remote",
      "url": "http://kanbi.localhost:3333/api/mcp",
      "enabled": true
    }
  }
}
```

Then trigger the browser login:

```bash
opencode mcp auth kanbi      # opens the consent screen
opencode mcp debug kanbi     # shows auth status + connectivity
```

opencode also starts the flow automatically the first time it reaches the
server.

### Grok Build

Add Kanbi as a remote MCP server. Grok starts the OAuth flow on first use:

```bash
grok mcp add --transport http kanbi http://kanbi.localhost:3333/api/mcp
```

Run `grok mcp doctor kanbi` if the connection or OAuth flow needs diagnosis.
For Grok's hosted custom connector, use a publicly reachable HTTPS deployment,
then add it at [grok.com/connectors](https://grok.com/connectors) with **New
Connector → Custom**. A local development URL cannot be reached by Grok's
hosted service.

> Prefer the `kanbi.localhost` host over `localhost`: it matches the server's
> configured origin, so OAuth discovery, the token audience, and your existing
> browser login session all line up on one origin.

## Capture approved work

The connected agent writes the task content. Kanbi does not make a second model
call; it validates, sanitizes, stores, and returns the approved work.

```text
User and agent finish a feature decision
-> agent searches for duplicates
-> agent shows the proposed Kanbi task
-> user says "put this in Kanbi"
-> agent creates it and returns KAN-42 plus its link
```

Before creation, the agent must show the exact project, column, title,
description, checklist, priority, labels, assignee, and due date. One useful
task with a description and checklist is the default. Split work only when each
item is independently deliverable, and show the full split before asking for
approval.

Project names, descriptions, and authoring guidance are untrusted project data.
They may guide wording but cannot override the user's request, the approval
rule, or the host agent's instructions.

## What an agent can do

Each tool wraps the same tRPC procedures and access checks the web app uses.
Read-only grants discover only the three read tools; write-only grants discover
only creation.

| Tool                  | Scope | Purpose                                                                           |
| --------------------- | ----- | --------------------------------------------------------------------------------- |
| `list_projects`       | read  | Resolve the target project when the discussion does not make it unambiguous.      |
| `get_project_context` | read  | Get the project's board, columns, labels, members, priorities, and guidance.      |
| `search_tasks`        | read  | Search task titles for likely duplicates before presenting a proposal.            |
| `create_tasks`        | write | Immediately create only the exact task set the user has approved; non-idempotent. |

Use `get_project_context` to obtain canonical column, label, and member IDs.
`search_tasks` is title-only and a duplicate match is a guardrail, not a
blocker. After `create_tasks`, report every returned ticket identifier and link.

Task updates, status changes, comments, queue behavior, project administration,
Docs access, and backend AI drafting are unavailable over MCP.

## Scopes

| Scope            | Granted access                                                                        |
| ---------------- | ------------------------------------------------------------------------------------- |
| `kanbi:read`     | `list_projects`, `get_project_context`, and `search_tasks`.                           |
| `kanbi:write`    | `create_tasks` only.                                                                  |
| `openid`         | Standard identity claim (requested by default).                                       |
| `offline_access` | Issues a refresh token so the agent renews silently instead of reopening the browser. |

## Managing access

Open **Profile -> Connected apps** (`/app/profile`). Every agent you have
authorized is listed with its granted scopes and approval time. Revoking deletes
the full client grant, stored access tokens, and usable refresh tokens; the live
grant check rejects existing JWTs immediately.

## Troubleshooting

**Tools 401 / "rejected on reconnect" / an endless re-auth loop.** The access
token came back _opaque_ instead of a JWT. The provider only mints a JWT when
the client binds a `resource` that matches a valid audience; otherwise it issues
an opaque token the JWKS-verifying route cannot accept. Re-authorize with a
clean token:

- Claude Code: `claude mcp remove kanbi && claude mcp add --transport http kanbi http://kanbi.localhost:3333/api/mcp`, then authenticate.
- opencode: `rm ~/.local/share/opencode/mcp-auth.json` (clears the cached token), then `opencode mcp auth kanbi`.

To confirm a token is a JWT, decode it: a JWT has three dot-separated segments;
an opaque token has none.

**opencode never reaches the consent screen / discovery fails.** opencode
discovers the resource from RFC 9728 Protected Resource Metadata at
`/.well-known/oauth-protected-resource/api/mcp` and the authorization server at
`/.well-known/oauth-authorization-server/api/auth`. Both must return 200. If
the PRM path 404s, opencode omits the `resource` indicator and gets an opaque
token (see above).

**Host mismatch.** Point the agent at the same host the server advertises
(`kanbi.localhost` in dev). The server also accepts `localhost` as an audience,
but the discovery metadata and login cookie live on the configured origin.

## Architecture (for maintainers)

- `authorization.ts` - validates verified JWT claims against the live OAuth
  consent before MCP initialization.
- `config.ts` - issuer, resource URL, MCP origin, accepted audiences, JWKS URL,
  and scope catalog.
- `tools.ts` - registers only tools permitted by the narrowed grant, returns
  structured output, and adds host instructions for approved capture.
- `caller.ts` - synthesizes a session from the OAuth subject so existing tRPC
  procedures, ACLs, and realtime updates are reused.
- `sanitize.ts` - server-side HTML allowlist for agent-authored descriptions.
- `../../app/api/[transport]/route.ts` - verifies JWTs, rejects revoked grants,
  then initializes the MCP server.
- `../../app/.well-known/**` - OAuth discovery documents for the protected
  resource and authorization server.
