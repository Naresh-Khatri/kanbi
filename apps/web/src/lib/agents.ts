/** Coding agents an MCP client can declare itself as; icons live in /public/agents/<id>.svg. */
export const AGENTS = {
  "claude-code": { label: "Claude Code", color: "#D97757", mono: false },
  codex: { label: "Codex", color: "#10A37F", mono: true },
  antigravity: { label: "Antigravity", color: "#3186FF", mono: false },
  opencode: { label: "opencode", color: "#71717A", mono: true },
  cursor: { label: "Cursor", color: "#71717A", mono: true },
  copilot: { label: "GitHub Copilot", color: "#8957E5", mono: true },
  "gemini-cli": { label: "Gemini CLI", color: "#4F7DF3", mono: false },
  "kilo-code": { label: "Kilo Code", color: "#E5C100", mono: true },
  cline: { label: "Cline", color: "#71717A", mono: true },
  "roo-code": { label: "Roo Code", color: "#6366F1", mono: true },
  windsurf: { label: "Windsurf", color: "#0FB5AE", mono: true },
  amp: { label: "Amp", color: "#F34E3F", mono: false },
  junie: { label: "Junie", color: "#47E054", mono: false },
  kiro: { label: "Kiro", color: "#993FF5", mono: false },
  "qwen-code": { label: "Qwen Code", color: "#615CED", mono: true },
  other: { label: "AI agent", color: "#71717A", mono: true },
} as const satisfies Record<
  string,
  { label: string; color: string; mono: boolean }
>;

export type AgentId = keyof typeof AGENTS;
export const AGENT_IDS = Object.keys(AGENTS) as [AgentId, ...AgentId[]];

export const isAgentId = (value: unknown): value is AgentId =>
  typeof value === "string" && Object.hasOwn(AGENTS, value);

/** Unknown/legacy ids fall back to the generic agent. */
export function agentMeta(id: string) {
  const key = isAgentId(id) ? id : "other";
  return { id: key, ...AGENTS[key] };
}

const NAME_HINTS: [RegExp, AgentId][] = [
  [/claude/i, "claude-code"],
  [/codex|openai/i, "codex"],
  [/antigravity/i, "antigravity"],
  [/open\s*code/i, "opencode"],
  [/cursor/i, "cursor"],
  [/copilot|vs\s*code|visual studio/i, "copilot"],
  [/gemini/i, "gemini-cli"],
  [/kilo/i, "kilo-code"],
  [/cline/i, "cline"],
  [/roo/i, "roo-code"],
  [/windsurf|codeium/i, "windsurf"],
  [/\bamp\b/i, "amp"],
  [/junie/i, "junie"],
  [/kiro/i, "kiro"],
  [/qwen/i, "qwen-code"],
];

/** Best guess from an OAuth client name, for calls that don't declare an agent. */
export function agentFromClientName(name: string | null | undefined): AgentId {
  if (!name) return "other";
  return NAME_HINTS.find(([re]) => re.test(name))?.[1] ?? "other";
}
