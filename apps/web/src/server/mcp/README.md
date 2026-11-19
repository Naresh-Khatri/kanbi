# Kanbi MCP server

Kanbi's [Model Context Protocol](https://modelcontextprotocol.io) server does
two things: it turns a finished agent discussion into reviewed Kanbi tasks
(capture), and it lets a coding agent pull your own assigned tasks for the
current repo, fix them, and close them (work).

- **Endpoint:** `https://kanbi.nareshkhatri.dev/api/mcp` (Streamable HTTP). In
  local dev it is `http://kanbi.localhost:3333/api/mcp`.
- **Auth:** OAuth 2.1 with a browser consent screen. The agent registers itself
  (RFC 7591 Dynamic Client Registration), you log in once and approve, and it
  receives a JWT access token. There are no API keys to copy or paste.
- **Authorization:** `kanbi:read` and `kanbi:write` are checked against the
  live OAuth consent on every MCP request. Revoking an app takes effect
  immediately, even for an unexpired JWT.

Everything below uses the production host, `kanbi.nareshkhatri.dev`. Against a
local dev server, swap in `http://kanbi.localhost:3333`. Keep the exact scheme:
MCP OAuth clients reject discovery redirects that change origin, including an
`http://` to `https://` redirect.

## Connect an agent

### Claude Code

```bash
claude mcp add --transport http kanbi https://kanbi.nareshkhatri.dev/api/mcp
```

Then run any Kanbi tool (or `/mcp` in the TUI) and Claude opens the browser
consent flow. After you approve, the tools are available.

### Codex

Add the remote Streamable HTTP server, then complete the OAuth login:

```bash
codex mcp add kanbi --url https://kanbi.nareshkhatri.dev/api/mcp
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
      "url": "https://kanbi.nareshkhatri.dev/api/mcp",
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
grok mcp add --transport http kanbi https://kanbi.nareshkhatri.dev/api/mcp
```

Run `grok mcp doctor kanbi` if the connection or OAuth flow needs diagnosis.
For Grok's hosted custom connector, use a publicly reachable HTTPS deployment,
then add it at [grok.com/connectors](https://grok.com/connectors) with **New
Connector → Custom**. A local development URL cannot be reached by Grok's
hosted service.

> Against a local dev server, use `http://kanbi.localhost:3333/api/mcp` rather
> than `localhost`: it matches the server's configured origin, so OAuth
> discovery, the token audience, and your existing browser login session all
> line up on one origin.

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
description, checklist, priority, labels, assignee, and due date. The same rule
covers projects and columns: `create_project` needs an approved name, key,
description, default columns (Backlog, Todo, In Progress, In Review, Done), and
default labels; `add_column` and `update_column` need an approved name,
category, and position. One useful
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
                         then up to 5 ready tasks (priority, due date, age);
                         blocked tasks listed separately as waitingOnPeople
get_task(KAN-42)      -> brief + inlined images + up to 3 linked docs
start_task(KAN-42)    -> moves to the board's first in-progress column
move_task(KAN-42, "In Review")
                      -> only when the user asks; any open column, by name
                         (case-insensitive) or id; never done or canceled
... agent fixes the problem, runs the repo's checks, maybe update_checklist /
    add_attachment + PUT for a screenshot, pasting its `markdown` into the
    summary ...
finish_task(KAN-42, summary, prUrl?)
                      -> ticks completed checklist items, moves to the first
                         review column (first done column if none), posts the
                         summary as an agent comment
report_blocker(KAN-42, reason)
                      -> instead of finishing: posts the blocker, records
                         task.blocked, moves the task back to ready; it stays
                         out of the ready list until a person comments or
                         edits it
```

- **Scope:** only tasks assigned to you, in `unstarted` or `started` columns.
  Backlog counts as ready only on boards with no `unstarted` column (e.g.
  boards created before Todo became a default column). Archived and closed
  tasks never appear. The board itself is the state: there is no cursor,
  lease, or repo config file.
- **Project inference:** the repo basename (or remote) is matched to project
  slug, name, or key. Exact matches win over partial ones. If a repo hint
  matches nothing, the agent gets candidates and asks; it never guesses.
  Projects on hold are skipped; if the repo only matches one, the agent is told
  to ask before passing its `projectId`. Archived projects never appear.
- **Acts as you, visibly:** every change goes through the normal tRPC
  procedures as you, so activity, notifications, and realtime updates are the
  same as in the app. Write tools take an `agent` id (`lib/agents.ts`; guessed
  from the OAuth client name when omitted) that is stored on the comment
  (`comment.agent`) and shown as a badge, subject to the project's agent
  disclosure setting; `get_task` labels these comments as agent-posted. An
  agent can edit or delete only comments its own OAuth client posted
  (`comment.agent_client_id`), never ones you typed. Identical comments
  retried within 10 minutes are deduplicated.
- **Write scope:** every task write tool acts only on tasks assigned to you
  (`create_tasks` and the project and column tools are capture tools, not task
  writes). Agents never edit a task's title or description, archive, delete, or
  reassign.
- **Races:** `start_task`, `move_task`, and `finish_task` move with a compare-and-swap on the
  current column (`task.move` `expectedColumnId`). If someone moved the card
  meanwhile, the call fails and the agent re-reads the queue.
- **Trust order:** the brief puts the original request (`task.source_text`)
  and images first, then people's comments, then the title. The AI-drafted
  description and checklist come last and are labeled as possibly wrong.
  `source_text` stores the raw input to the AI drafter and to Enhance. It is
  MCP-only and kept out of board and public share payloads
  (`server/tasks/columns.ts`).
- **Since last update:** once one of your agents has changed a task, `get_task`
  opens with what people did after that (latest move, comments, edits,
  attachments) and marks their newer comments `NEW`, so a task sent back from
  review shows the feedback first.
- **Images:** up to 4 png/jpeg/gif/webp attachments are inlined as image
  content: the reporter's first task screenshot, then people's images newest
  first, then agent uploads. `get_task_images` inlines the next 4 from the
  offset the brief gives. Images wider or taller than 1568px, or over about
  3.75 MB, are shrunk with sharp (png, jpeg if still too heavy; first frame of
  a gif) instead of skipped. Images embedded in the
  description or comments appear in the text as `[label]` placeholders that
  match the image list. Other files are listed with short-lived links.
- **Attachments from the agent:** `add_attachment` returns a presigned R2 PUT
  URL (and a ready curl command) valid for 10 minutes, plus a `markdown` field
  (`![name](kanbi-upload:<key>)`). Pasting that into a `finish_task` summary or
  comment body embeds the image inline (`.mp4`/`.webm` files become an inline
  video player); the server verifies the upload and
  records the attachment, so no `confirm_attachment` call is needed. To attach
  without embedding, call `confirm_attachment`, which also returns `markdown`
  and `url`. Bytes never pass through the model. Requires R2 to be configured.
- **Seen in the app:** changes made by agents (activity `payload.agent`) and
  others show up on the board as highlighted cards and an Updates filter until
  the user opens the task or marks the board as seen.
- **Docs:** read-only. `get_task` inlines up to 3 docs linked to the task
  (4,000 chars each); `list_docs`, `get_doc`, and `search_docs` (keyword,
  ranked) cover the rest. Images pasted into a doc come back as 1-hour
  presigned urls, since the agent has no session cookie for `/api/files`. Docs
  are presented as possibly outdated reference data. There is no doc writing
  and no `ask_docs` (that would be a second model call).

## What an agent can do

Each tool wraps the same tRPC procedures and access checks the web app uses.
Read-only grants discover only the read tools; write-only grants discover only
the mutations. The `work` prompt needs both scopes.

| Tool                  | Scope | Purpose                                                                           |
| --------------------- | ----- | --------------------------------------------------------------------------------- |
| `list_projects`       | read  | Resolve the target project when the discussion does not make it unambiguous.      |
| `get_project_context` | read  | Get the project's board, columns, labels, members, priorities, and guidance.      |
| `search_tasks`        | read  | Title search for duplicates, or lookup by identifier (`KAN-42`); shows assignee.  |
| `create_tasks`        | write | Create only the exact approved task set; retry-safe with `requestKey`.            |
| `create_project`      | write | Create an approved project with default columns; returns its context and URL.     |
| `add_column`          | write | Owner only: add an approved column; default spot is the end of its category.      |
| `update_column`       | write | Owner only: rename, recategorize, or reorder; keeps the last done column.         |
| `find_tasks`          | read  | Ad-hoc questions: who, when, status, assignee, label, priority; pages by offset.  |
| `get_work_queue`      | read  | Your open assigned tasks for the project matching the repo.                       |
| `get_task`            | read  | Trust-ordered brief: first 4 images inlined, latest 20 comments.                  |
| `get_task_comments`   | read  | Page older comments (`offset` back from newest, up to 50 per call).               |
| `get_task_images`     | read  | Inline the next 4 images from the `offset` `get_task` gives.                      |
| `start_task`          | write | Move your task to the first in-progress column; repeat-safe.                      |
| `move_task`           | write | Move your task to another open column by name or id; done goes via `finish_task`. |
| `finish_task`         | write | Tick checklist items, move to review (else done), post the summary as a comment.  |
| `assign_to_me`        | write | Claim an unassigned open task; never takes one assigned to someone else.          |
| `comment_on_task`     | write | Post a marked comment: a result, blocker, or question. Markdown in.               |
| `report_blocker`      | write | Post the blocker, move the task back to ready, park it in `waitingOnPeople`.      |
| `update_checklist`    | write | Complete, reopen, or add checklist items on your task.                            |
| `set_task_labels`     | write | Add/remove existing board labels by name; never creates labels.                   |
| `add_attachment`      | write | Get a presigned upload URL (max 25 MB) and `markdown` to embed the image inline.  |
| `confirm_attachment`  | write | Record an uploaded file on the task after verifying it exists.                    |
| `edit_comment`        | write | Edit a comment this agent client posted.                                          |
| `delete_comment`      | write | Delete a comment this agent client posted.                                        |
| `list_docs`           | read  | A project's doc pages as a tree.                                                  |
| `get_doc`             | read  | One doc page as markdown, chunked; follow `nextOffset` for long pages.            |
| `search_docs`         | read  | Keyword search over doc titles and text with excerpts.                            |

Use `get_project_context` to obtain canonical column, label, and member IDs.
`search_tasks` matches titles (and exact identifiers) only, and a duplicate
match is a guardrail, not a blocker. After `create_tasks`, report every
returned ticket identifier and link. Pass a `requestKey` (one per approved
preview): a retry with the same key and tasks returns the first result for 24
hours instead of creating duplicates (`kanbi_mcp_request`). Reusing a key for
different tasks is rejected. `create_project` and `add_column` take a required
`requestKey` the same way.
`create_project` sends its key explicitly (derived from the name's initials
when omitted), so a taken key fails with a suggested alternative instead of
silently becoming `KEY2`. Column tools resolve names case-insensitively, refuse
duplicate names, and place columns with fractional positions (`lib/position.ts`);
they never renumber, and refuse when there is no room left between two columns.
`create_tasks` takes an optional `followUpOf` task: each new description links
back to it, and if that task is yours, it gets a comment listing the follow-ups.

Editing task titles or descriptions, writing to other people's tasks, archiving
or deleting anything (tasks, columns, projects), creating labels, project
settings and membership, writing docs, and backend AI drafting are unavailable
over MCP.

## Scopes

| Scope            | Granted access                                                                                                                                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kanbi:read`     | `list_projects`, `get_project_context`, `search_tasks`, `find_tasks`, `get_work_queue`, `get_task`, `get_task_comments`, `get_task_images`, `list_docs`, `get_doc`, `search_docs`.                                                                                               |
| `kanbi:write`    | `create_tasks`, `create_project`, `add_column`, `update_column`, `start_task`, `finish_task`, `move_task`, `assign_to_me`, `comment_on_task`, `report_blocker`, `update_checklist`, `set_task_labels`, `add_attachment`, `confirm_attachment`, `edit_comment`, `delete_comment`. |
| `openid`         | Standard identity claim (requested by default).                                                                                                                                                                                                                                  |
| `offline_access` | Issues a refresh token so the agent renews silently instead of reopening the browser.                                                                                                                                                                                            |

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

- Claude Code: `claude mcp remove kanbi && claude mcp add --transport http kanbi https://kanbi.nareshkhatri.dev/api/mcp`, then authenticate.
- opencode: `rm ~/.local/share/opencode/mcp-auth.json` (clears the cached token), then `opencode mcp auth kanbi`.

To confirm a token is a JWT, decode it: a JWT has three dot-separated segments;
an opaque token has none.

**opencode never reaches the consent screen / discovery fails.** opencode
discovers the resource from RFC 9728 Protected Resource Metadata at
`/.well-known/oauth-protected-resource/api/mcp` and the authorization server at
`/.well-known/oauth-authorization-server/api/auth`. Both must return 200. If
the PRM path 404s, opencode omits the `resource` indicator and gets an opaque
token (see above).

**Host mismatch.** Point the agent at the same origin the server advertises
(`BETTER_AUTH_URL`; `kanbi.localhost` in dev). The server also accepts
`localhost` as an audience, but the discovery metadata and login cookie live on
the configured origin.

## Architecture (for maintainers)

- `authorization.ts` - validates verified JWT claims against the live OAuth
  consent before MCP initialization.
- `config.ts` - issuer, resource URL, MCP origin, accepted audiences, JWKS URL,
  and scope catalog.
- `tools.ts` - registers only tools permitted by the narrowed grant, returns
  structured output, and adds host instructions for capture and work.
  `project-context.ts` loads the `get_project_context` shape; `columns.ts`
  holds column lookup, placement, and the owner and last-done-column guards.
- `work.ts` - work-mode tools and the `work` prompt; `work-queue.ts` holds the
  pure repo matching, ordering, and brief building.
- `find.ts` - `find_tasks`, read-only ad-hoc task lookup.
- `collaborate.ts` - comments, blockers, checklist, labels, attachments on the
  user's assigned tasks; `task-ref.ts` holds the shared task resolution, column
  moves, and agent comment posting.
- `docs.ts` - read-only doc tools.
- `result.ts` - shared tool results; `McpUserError` messages reach the agent
  verbatim, everything else is logged and genericized.
- `caller.ts` - synthesizes a session from the OAuth subject so existing tRPC
  procedures, ACLs, and realtime updates are reused.
- `sanitize.ts` - server-side HTML allowlist for agent-authored descriptions.
- `../../app/api/[transport]/route.ts` - verifies JWTs, rejects revoked grants,
  then initializes the MCP server.
- `../../app/.well-known/**` - OAuth discovery documents for the protected
  resource and authorization server.
