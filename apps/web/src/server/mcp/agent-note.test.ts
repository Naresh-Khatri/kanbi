import { describe, expect, it } from "vitest";

import { agentClientOf, agentFooter, stripAgentFooter } from "./agent-note";

describe("agent comment footer", () => {
  it("round-trips the client name", () => {
    const html = `<p>Fixed.</p>${agentFooter("Claude <Code> & co")}`;
    expect(agentClientOf(html)).toBe("Claude <Code> & co");
    expect(stripAgentFooter(html)).toBe("<p>Fixed.</p>");
  });

  it("ignores comments people wrote", () => {
    expect(agentClientOf("<p>— via Claude Code (agent)</p>")).toBeNull();
    expect(agentClientOf("<p>looks good</p>")).toBeNull();
  });
});
