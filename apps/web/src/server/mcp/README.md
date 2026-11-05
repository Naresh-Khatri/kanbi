# Kanbi MCP server

Kanbi's [Model Context Protocol](https://modelcontextprotocol.io) server does
two things: it turns a finished agent discussion into reviewed Kanbi tasks
(capture), and it lets a coding agent pull your own assigned tasks for the
current repo, fix them, and close them (work).

- **Endpoint:** `https://<your-kanbi-host>/api/mcp` (Streamable HTTP). In local
  dev that is `http://kanbi.localhost:3333/api/mcp`.
- **Auth:** OAuth 2.1 with a browser consent screen. The agent registers itself
  (RFC 7591 Dynamic Client Registration), you log in once and approve, and it
  receives a JWT access token. There are no API keys to copy or paste.
- **Authorization:** `kanbi:read` and `kanbi:write` are checked against the
  live OAuth consent on every MCP request. Revoking an app takes effect
  immediately, even for an unexpired JWT.

Everything below uses `kanbi.localhost:3333` as the example host. Swap in your
own deployment origin in production, including the exact scheme. Public
deployments should use `https://`; MCP OAuth clients reject discovery redirects
that change origin, including an `http://` to `https://` redirect.

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

## Work your assigned tasks

Run the `work` prompt from the repo you want fixed. In Claude Code that is
`/mcp__kanbi__work` (optionally `/mcp__kanbi__work KAN-42`); to keep pulling new
work, `/loop 15m /mcp__kanbi__work`.

```text
get_work_queue(repo)  -> project matched from the repo name; in-progress first,
                         then up to 5 ready tasks (priority, due date, age)
get_task(KAN-42)      -> brief + inlined images
start_task(KAN-42)    -> moves to the board's first in-progress column
... agent fixes the problem and runs the repo's checks ...
finish_task(KAN-42)   -> ticks completed checklist items, moves to first done column
```

- **Scope:** only tasks assigned to you, in `unstarted` or `started` columns.
  Backlog counts as ready only on boards with no `unstarted` column (the
  default board). Archived and closed tasks never appear. The board itself is the
  state: there is no cursor, lease, or repo config file.
- **Project inference:** the repo basename (or remote) is matched to project
  slug, name, or key. Exact matches win over partial ones. If a repo hint
  matches nothing, the agent gets candidates and asks; it never guesses.
- **No trace:** every change goes through the normal tRPC procedures as you.
  Activity, notifications, and realtime updates look like you moved the card.
  Agents never comment or edit tasks.
- **Races:** `start_task` and `finish_task` move with a compare-and-swap on the
  current column (`task.move` `expectedColumnId`). If someone moved the card
  meanwhile, the call fails and the agent re-reads the queue.
- **Trust order:** the brief puts the original request (`task.source_text`)
  and images first, then people's comments, then the title. The AI-drafted
  description and checklist come last and are labeled as possibly wrong.
  `source_text` stores the raw input to the AI drafter and to Enhance. It is
  MCP-only and kept out of board and public share payloads
  (`server/tasks/columns.ts`).
- **Images:** up to 4 png/jpeg/gif/webp attachments of up to about 3.75 MB each
  are inlined as image content. Other files are listed with short-lived links.

## What an agent can do

Each tool wraps the same tRPC procedures and access checks the web app uses.
Read-only grants discover only the read tools; write-only grants discover only
the mutations. The `work` prompt needs both scopes.

| Tool                  | Scope | Purpose                                                                           |
| --------------------- | ----- | --------------------------------------------------------------------------------- |
| `list_projects`       | read  | Resolve the target project when the discussion does not make it unambiguous.      |
| `get_project_context` | read  | Get the project's board, columns, labels, members, priorities, and guidance.      |
| `search_tasks`        | read  | Search task titles for likely duplicates before presenting a proposal.            |
| `create_tasks`        | write | Immediately create only the exact task set the user has approved; non-idempotent. |
| `find_tasks`          | read  | Ad-hoc questions: who added what, when, status, assignee, label, priority, text.  |
| `get_work_queue`      | read  | Your open assigned tasks for the project matching the repo.                       |
| `get_task`            | read  | Trust-ordered markdown brief with images inlined.                                 |
| `start_task`          | write | Move your task to the first in-progress column; repeat-safe.                      |
| `finish_task`         | write | Tick completed checklist items and move to the first done column.                 |

Use `get_project_context` to obtain canonical column, label, and member IDs.
`search_tasks` is title-only and a duplicate match is a guardrail, not a
blocker. After `create_tasks`, report every returned ticket identifier and link.

Task edits, comments, other people's tasks, project administration, Docs
access, and backend AI drafting are unavailable over MCP.

## Scopes

| Scope            | Granted access                                                                        |
| ---------------- | ------------------------------------------------------------------------------------- |
| `kanbi:read`     | `list_projects`, `get_project_context`, `search_tasks`, `find_tasks`, `get_work_queue`, `get_task`. |
| `kanbi:write`    | `create_tasks`, `start_task`, `finish_task`.                                          |
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
  structured output, and adds host instructions for capture and work.
- `work.ts` - work-mode tools and the `work` prompt; `work-queue.ts` holds the
  pure repo matching, ordering, and brief building.
- `find.ts` - `find_tasks`, read-only ad-hoc task lookup.
- `result.ts` - shared tool results; `McpUserError` messages reach the agent
  verbatim, everything else is logged and genericized.
- `caller.ts` - synthesizes a session from the OAuth subject so existing tRPC
  procedures, ACLs, and realtime updates are reused.
- `sanitize.ts` - server-side HTML allowlist for agent-authored descriptions.
- `../../app/api/[transport]/route.ts` - verifies JWTs, rejects revoked grants,
  then initializes the MCP server.
- `../../app/.well-known/**` - OAuth discovery documents for the protected
  resource and authorization server.
