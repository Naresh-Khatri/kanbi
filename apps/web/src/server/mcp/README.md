# Kanbi MCP server

Kanbi exposes a [Model Context Protocol](https://modelcontextprotocol.io) server so
coding agents (Claude Code, opencode, and any MCP-capable client) can read and
update your boards from inside an editor or terminal session.

- **Endpoint:** `https://<your-kanbi-host>/api/mcp` (Streamable HTTP).
  In local dev that is `http://kanbi.localhost:3333/api/mcp`.
- **Auth:** OAuth 2.1 with a browser consent screen. The agent registers itself
  (RFC 7591 Dynamic Client Registration), you log in once and approve, and it
  receives a JWT access token. There are no API keys to copy or paste.
- **Authorization:** two scopes, `kanbi:read` and `kanbi:write`, enforced per
  tool. You can revoke any agent's access at any time from your profile.

Everything below uses `kanbi.localhost:3333` as the example host. Swap in your
own deployment origin in production.

## Connect an agent

### Claude Code

```bash
claude mcp add --transport http kanbi http://kanbi.localhost:3333/api/mcp
```

Then run any kanbi tool (or `/mcp` in the TUI) and Claude opens the browser
consent flow. After you approve, the tools are available.

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

opencode also starts the flow automatically the first time it hits the server.

> Prefer the `kanbi.localhost` host over `localhost`: it matches the server's
> configured origin, so OAuth discovery, the token audience, and your existing
> browser login session all line up on one origin.

## What an agent can do

Each tool is a thin wrapper over the same tRPC procedures the web app uses, so
project/board permissions, validation, and realtime updates all apply
identically. The agent acts as you, limited to the boards you can access.

| Tool                | Scope | Purpose                                                                                                                             |
| ------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `list_projects`     | read  | List projects you can access.                                                                                                       |
| `list_boards`       | read  | List boards across your projects.                                                                                                   |
| `get_board`         | read  | A board's columns, their tasks, and labels.                                                                                         |
| `search_tasks`      | read  | Full-text search across tasks you can access.                                                                                       |
| `get_board_context` | read  | Authoring context for a board: project name/description/system prompt, label + column + member ids, valid priorities, today's date. |
| `create_tasks`      | write | Create one or more tasks on a board.                                                                                                |
| `update_task`       | write | Update fields on a task (pass `null` to clear assignee/dueAt/description).                                                          |
| `add_comment`       | write | Add a comment to a task.                                                                                                            |

Typical write flow: call `get_board_context` first to get the real column,
label, and member ids, then pass those ids verbatim to `create_tasks`. Dates are
plain `YYYY-MM-DD`; descriptions and comment bodies are simple HTML
(`<p>`, `<strong>`, `<em>`, `<code>`, `<a>`, `<ul>`/`<ol>`/`<li>`).

## Scopes

| Scope            | Granted access                                                                        |
| ---------------- | ------------------------------------------------------------------------------------- |
| `kanbi:read`     | All read tools above.                                                                 |
| `kanbi:write`    | All write tools above.                                                                |
| `openid`         | Standard identity claim (requested by default).                                       |
| `offline_access` | Issues a refresh token so the agent renews silently instead of reopening the browser. |

Scopes are checked on every tool call against the verified token, so a
read-only grant cannot create or edit anything.

## Managing access

Open **Profile -> Connected apps** (`/app/profile`). Every agent you have
authorized is listed with its granted scopes and when it was approved. Revoking
deletes the grant immediately; the agent must re-authorize to reconnect.

## How content is authored

The agent's own model writes the content. The server deliberately does **not**
run any backend AI drafting on the MCP surface: instead `get_board_context`
exposes the project's conventions (name, description, system prompt) and the
agent authors the tasks. The server keeps the guarantees that must not be left
to a client: scope checks, the board/project ACLs (reused from tRPC), HTML
sanitization of agent-authored descriptions and comments, fractional ordering
positions, and id validation.

## Troubleshooting

**Tools 401 / "rejected on reconnect" / an endless re-auth loop.**
The access token came back _opaque_ instead of a JWT. The provider only mints a
JWT when the client binds a `resource` that matches a valid audience; otherwise
it issues an opaque token the JWKS-verifying route cannot accept. Re-authorize
with a clean token:

- Claude Code: `claude mcp remove kanbi && claude mcp add --transport http kanbi http://kanbi.localhost:3333/api/mcp`, then authenticate.
- opencode: `rm ~/.local/share/opencode/mcp-auth.json` (clears the cached token), then `opencode mcp auth kanbi`.

To confirm a token is a JWT, decode it: a JWT has three dot-separated segments;
an opaque token has none.

**opencode never reaches the consent screen / discovery fails.**
opencode discovers the resource from RFC 9728 Protected Resource Metadata at
`/.well-known/oauth-protected-resource/api/mcp` and the authorization server at
`/.well-known/oauth-authorization-server/api/auth`. Both must return 200 (curl
them). If the PRM path 404s, opencode omits the `resource` indicator and gets an
opaque token (see above).

**Host mismatch.** Point the agent at the same host the server advertises
(`kanbi.localhost` in dev). The server also accepts `localhost` as an audience,
but the discovery metadata and login cookie live on the configured origin.

## Architecture (for maintainers)

- `config.ts` - issuer, resource URL, accepted audiences, JWKS URL, scope catalog.
- `tools.ts` - registers every tool; `run(scope, fn)` checks the scope, builds a
  caller as the token subject, and calls the matching tRPC procedure.
- `caller.ts` - synthesizes a session from the verified JWT `sub` so the existing
  protected/project/board procedures, ACLs, and realtime bus are reused.
- `sanitize.ts` - server-side HTML allowlist applied to agent-authored rich text.
- `../../app/api/[transport]/route.ts` - the MCP route; `mcpHandler` verifies the
  JWT against the JWKS, then hands the claims to the tool layer.
- `../../app/.well-known/**` - OAuth discovery documents (protected resource,
  authorization server, openid configuration), served at both the root and the
  RFC-path-aware locations.
- OAuth provider + JWT plugin are registered in `../better-auth/config.ts`; the
  `oauth_*` and `jwks` tables live in `../db/schema.ts`.
