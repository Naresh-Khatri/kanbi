import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { CodeBlock } from "../_components/code-block";

export const metadata: Metadata = {
  title: "Connect an AI agent · Kanbi",
  description:
    "Connect Claude Code, opencode, or any MCP client to read and write your Kanbi boards over OAuth.",
};

const TOOLS = [
  { name: "list_projects", scope: "read", purpose: "List projects you can access." },
  { name: "list_boards", scope: "read", purpose: "List boards across your projects." },
  { name: "get_board", scope: "read", purpose: "A board's columns, tasks, and labels." },
  { name: "search_tasks", scope: "read", purpose: "Full-text search across tasks." },
  {
    name: "get_board_context",
    scope: "read",
    purpose: "Column, label, and member ids plus valid priorities, for authoring.",
  },
  { name: "create_tasks", scope: "write", purpose: "Create one or more tasks on a board." },
  { name: "update_task", scope: "write", purpose: "Update fields on a task." },
  { name: "add_comment", scope: "write", purpose: "Add a comment to a task." },
] as const;

/** Build the live origin so the copy-paste commands match this deployment. */
async function getEndpoint() {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "kanbi.localhost:3333";
  const proto =
    h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}/api/mcp`;
}

function ScopeTag({ scope }: { scope: "read" | "write" }) {
  return (
    <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[11px] text-white/50">
      {scope}
    </span>
  );
}

export default async function McpDocsPage() {
  const endpoint = await getEndpoint();
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
      <p className="text-sm font-medium text-white/40">MCP server</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
        Connect an AI agent
      </h1>
      <p className="mt-3 text-lg text-white/70">
        Kanbi exposes a Model Context Protocol server so coding agents — Claude
        Code, opencode, any MCP client — can read and write your boards from your
        editor or terminal. Auth is OAuth with a browser consent screen; there
        are no API keys to copy.
      </p>

      <div className="mt-6 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-xs tracking-wide text-white/40 uppercase">Endpoint</p>
        <p className="mt-1 font-mono text-sm text-white/90">{endpoint}</p>
      </div>

      <h2 className="mt-12 text-lg font-semibold tracking-tight">Claude Code</h2>
      <p className="mt-2 text-sm text-white/70">
        Add the server, then run any kanbi tool (or <code>/mcp</code>) — Claude
        opens the consent screen, and after you approve the tools are live.
      </p>
      <div className="mt-3">
        <CodeBlock
          code={`claude mcp add --transport http kanbi ${endpoint}`}
        />
      </div>

      <h2 className="mt-12 text-lg font-semibold tracking-tight">opencode</h2>
      <p className="mt-2 text-sm text-white/70">
        Add the server to <code>opencode.json</code> (project) or{" "}
        <code>~/.config/opencode/opencode.json</code> (global):
      </p>
      <div className="mt-3">
        <CodeBlock code={opencodeConfig} />
      </div>
      <p className="mt-3 text-sm text-white/70">
        Then trigger the login (it also starts automatically the first time it
        hits the server):
      </p>
      <div className="mt-3">
        <CodeBlock code={`opencode mcp auth kanbi`} />
      </div>

      <h2 className="mt-12 text-lg font-semibold tracking-tight">
        What an agent can do
      </h2>
      <p className="mt-2 text-sm text-white/70">
        Each tool wraps the same procedures the web app uses, so permissions,
        validation, and realtime updates apply identically. The agent acts as
        you, limited to the boards you can access.
      </p>
      <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
        {TOOLS.map((tool) => (
          <li
            key={tool.name}
            className="flex items-center gap-3 px-4 py-2.5 text-sm"
          >
            <code className="text-white/90">{tool.name}</code>
            <ScopeTag scope={tool.scope} />
            <span className="ml-auto text-right text-white/50">
              {tool.purpose}
            </span>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-lg font-semibold tracking-tight">Scopes</h2>
      <p className="mt-2 text-sm text-white/70">
        Two scopes are enforced on every tool call: <code>kanbi:read</code> for
        the read tools and <code>kanbi:write</code> for the write tools. A
        read-only grant cannot create or edit anything. Add{" "}
        <code>offline_access</code> and the agent renews silently instead of
        reopening the browser.
      </p>

      <h2 className="mt-12 text-lg font-semibold tracking-tight">
        Managing access
      </h2>
      <p className="mt-2 text-sm text-white/70">
        Every agent you authorize is listed under{" "}
        <Link
          className="text-white underline underline-offset-4 transition hover:text-white/80"
          href="/app/profile"
        >
          Profile → Connected apps
        </Link>{" "}
        with its scopes and when it was approved. Revoking takes effect
        immediately; the agent must re-authorize to reconnect.
      </p>

      <h2 className="mt-12 text-lg font-semibold tracking-tight">
        Troubleshooting
      </h2>
      <p className="mt-2 text-sm text-white/70">
        <span className="text-white">Tools 401, or an endless re-auth loop.</span>{" "}
        The token came back opaque instead of a JWT. Re-authorize with a clean
        token — for Claude Code, <code>claude mcp remove kanbi</code> then add it
        again.
      </p>
      <p className="mt-2 text-sm text-white/70">
        <span className="text-white">Host mismatch.</span> Point the agent at the
        same host this page is served from, so OAuth discovery, the token
        audience, and your browser session all line up on one origin.
      </p>
    </article>
  );
}
