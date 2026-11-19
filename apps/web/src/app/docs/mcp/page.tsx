import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardPanel } from "@/components/ui/card";
import { Frame, FramePanel } from "@/components/ui/frame";
import { MCP_RESOURCE_URL } from "@/server/mcp/config";

import { CodeBlock } from "../_components/code-block";
import { DocsHero, DocsSection } from "../_components/docs-page";

export const metadata: Metadata = {
  title: "Connect an AI agent · Kanbi",
  description:
    "Connect an AI agent to capture reviewed Kanbi tasks over OAuth.",
};

const TOOLS = [
  {
    name: "list_projects",
    scope: "read",
    purpose: "Resolve the target project when it is not unambiguous.",
  },
  {
    name: "get_project_context",
    scope: "read",
    purpose: "Get canonical authoring IDs, guidance, and priorities.",
  },
  {
    name: "search_tasks",
    scope: "read",
    purpose: "Search task titles for likely duplicates.",
  },
  {
    name: "create_tasks",
    scope: "write",
    purpose: "Create only the exact task set the user approved.",
  },
  {
    name: "create_project",
    scope: "write",
    purpose: "Create an approved project with the default board.",
  },
  {
    name: "add_column",
    scope: "write",
    purpose: "Owner only: add an approved column to the board.",
  },
  {
    name: "update_column",
    scope: "write",
    purpose: "Owner only: rename, recategorize, or reorder a column.",
  },
  {
    name: "find_tasks",
    scope: "read",
    purpose: "Answer who added what, when, status, and assignee questions.",
  },
  {
    name: "get_work_queue",
    scope: "read",
    purpose: "Your open assigned tasks for the current repo.",
  },
  {
    name: "get_task",
    scope: "read",
    purpose: "Trust-ordered brief with images and linked docs.",
  },
  {
    name: "start_task",
    scope: "write",
    purpose: "Move your task to in progress.",
  },
  {
    name: "finish_task",
    scope: "write",
    purpose: "Move your task to review (or done) and post the summary.",
  },
  {
    name: "move_task",
    scope: "write",
    purpose: "Move your task to another open column when you ask.",
  },
  {
    name: "assign_to_me",
    scope: "write",
    purpose: "Claim an unassigned task so the agent can work on it.",
  },
  {
    name: "comment_on_task",
    scope: "write",
    purpose: "Post an agent-marked comment on your task.",
  },
  {
    name: "report_blocker",
    scope: "write",
    purpose: "Explain the blocker and move your task back to ready.",
  },
  {
    name: "update_checklist",
    scope: "write",
    purpose: "Complete, reopen, or add checklist items.",
  },
  {
    name: "set_task_labels",
    scope: "write",
    purpose: "Add or remove existing board labels.",
  },
  {
    name: "add_attachment",
    scope: "write",
    purpose: "Get an upload URL for a file such as a screenshot.",
  },
  {
    name: "confirm_attachment",
    scope: "write",
    purpose: "Record the uploaded file on the task.",
  },
  {
    name: "edit_comment",
    scope: "write",
    purpose: "Edit a comment the same agent posted.",
  },
  {
    name: "delete_comment",
    scope: "write",
    purpose: "Delete a comment the same agent posted.",
  },
  {
    name: "list_docs",
    scope: "read",
    purpose: "A project's doc pages as a tree.",
  },
  {
    name: "get_doc",
    scope: "read",
    purpose: "Read one doc page as markdown.",
  },
  {
    name: "search_docs",
    scope: "read",
    purpose: "Keyword search across docs.",
  },
] as const;

const LINK =
  "font-medium text-foreground underline underline-offset-4 hover:no-underline";

const FLOW = [
  "User and agent finish a feature decision",
  "Agent searches for duplicates",
  "Agent shows the proposed Kanbi task",
  "User says “put this in Kanbi”",
  "Agent creates it and returns KAN-42 plus its link",
];

export default function McpDocsPage() {
  const endpoint = MCP_RESOURCE_URL;
  const opencodeConfig = `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "kanbi": {
      "type": "remote",
      "url": "${endpoint}",
      "enabled": true
    }
  }
}`;

  return (
    <article>
      <DocsHero eyebrow="MCP server" title="Connect an AI agent">
        Kanbi exposes a Model Context Protocol server so coding agents — Codex,
        Claude Code, Grok Build, opencode, or another MCP client — can turn a
        finished discussion into reviewed Kanbi tasks from your editor or
        terminal. Auth is OAuth with a browser consent screen; there are no API
        keys to copy.
      </DocsHero>

      <Card className="mt-8">
        <CardPanel className="flex flex-col gap-1 px-4 py-3">
          <span className="text-muted-foreground text-xs font-medium">
            Endpoint
          </span>
          <code className="font-mono text-sm break-all">{endpoint}</code>
        </CardPanel>
      </Card>

      <DocsSection title="Claude Code">
        <p>
          Add the server, then run any kanbi tool (or <code>/mcp</code>) —
          Claude opens the consent screen, and after you approve the tools are
          live.
        </p>
        <CodeBlock code={`claude mcp add --transport http kanbi ${endpoint}`} />
      </DocsSection>

      <DocsSection title="Codex">
        <p>
          Add the remote server, then start the OAuth login. The same MCP setup
          is shared by the Codex CLI, desktop app, and IDE extension.
        </p>
        <CodeBlock
          code={`codex mcp add kanbi --url ${endpoint}\ncodex mcp login kanbi`}
        />
      </DocsSection>

      <DocsSection title="opencode">
        <p>
          Add the server to <code>opencode.json</code> (project) or{" "}
          <code>~/.config/opencode/opencode.json</code> (global):
        </p>
        <CodeBlock code={opencodeConfig} label="opencode.json" />
        <p>
          Then trigger the login (it also starts automatically the first time it
          hits the server):
        </p>
        <CodeBlock code="opencode mcp auth kanbi" />
      </DocsSection>

      <DocsSection title="Grok Build">
        <p>
          Add Kanbi as a remote server. Grok opens the OAuth flow when the
          server is first used.
        </p>
        <CodeBlock code={`grok mcp add --transport http kanbi ${endpoint}`} />
        <p>
          For Grok&apos;s hosted custom connector, use a publicly reachable
          HTTPS deployment, then add it at <code>grok.com/connectors</code>. A
          local development URL cannot be reached by the hosted service.
        </p>
      </DocsSection>

      <DocsSection title="What an agent can do">
        <p>
          Each tool wraps the same procedures the web app uses, so permissions,
          validation, and realtime updates apply identically. The agent acts as
          you, limited to the projects you can access.
        </p>
        <Frame>
          <FramePanel className="p-0">
            <ul className="divide-y">
              {TOOLS.map((tool) => (
                <li
                  className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-3"
                  key={tool.name}
                >
                  <span className="flex items-center gap-2">
                    <code className="font-mono text-[0.8125rem]">
                      {tool.name}
                    </code>
                    <Badge
                      className="font-mono"
                      variant={tool.scope === "write" ? "warning" : "secondary"}
                    >
                      {tool.scope}
                    </Badge>
                  </span>
                  <span className="text-muted-foreground sm:ms-auto sm:text-end">
                    {tool.purpose}
                  </span>
                </li>
              ))}
            </ul>
          </FramePanel>
        </Frame>
      </DocsSection>

      <DocsSection title="Capture approved work">
        <p>
          The connected agent writes the task content; Kanbi does not make a
          second model call. The agent searches for likely duplicates, shows the
          exact project, column, title, description, checklist, priority,
          labels, assignee, and due date, then waits for your explicit approval
          before it creates anything. New projects and board columns follow the
          same rule: the agent shows the exact name, key, or column placement
          first, and only project owners can change columns.
        </p>
        <Card>
          <CardPanel className="px-4 py-3">
            <ol className="flex flex-col gap-1.5 text-sm">
              {FLOW.map((step, i) => (
                <li className="flex gap-3" key={step}>
                  <span className="text-muted-foreground w-4 shrink-0 text-end tabular-nums">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </CardPanel>
        </Card>
        <p>
          One useful task with a description and checklist is the default. Work
          is split only when each item can be delivered independently, and the
          full split is shown before approval. Task management after creation is
          not available over MCP.
        </p>
      </DocsSection>

      <DocsSection title="Scopes">
        <p>
          Two scopes are enforced on every tool call: <code>kanbi:read</code>{" "}
          for the read tools and <code>kanbi:write</code> for the write tools. A
          read-only grant cannot create anything. Add{" "}
          <code>offline_access</code> and the agent renews silently instead of
          reopening the browser.
        </p>
      </DocsSection>

      <DocsSection title="Managing access">
        <p>
          Every agent you authorize is listed under{" "}
          <Link className={LINK} href="/app/profile">
            Profile → Connected apps
          </Link>{" "}
          with its scopes and when it was approved. Revoking takes effect
          immediately; the agent must re-authorize to reconnect.
        </p>
      </DocsSection>

      <DocsSection title="Troubleshooting">
        <p>
          <span className="text-foreground font-medium">
            Tools 401, or an endless re-auth loop.
          </span>{" "}
          The token came back opaque instead of a JWT. Re-authorize with a clean
          token — for Claude Code, <code>claude mcp remove kanbi</code> then add
          it again.
        </p>
        <p>
          <span className="text-foreground font-medium">Host mismatch.</span>{" "}
          Point the agent at the same host this page is served from, so OAuth
          discovery, the token audience, and your browser session all line up on
          one origin.
        </p>
      </DocsSection>
    </article>
  );
}
