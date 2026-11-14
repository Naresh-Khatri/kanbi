import { describe, expect, it } from "vitest";

import { agentFooter } from "@/server/mcp/agent-note";
import { discloseActivity, discloseComment } from "./disclosure";

const hidden = { userId: "mate", canAdmin: false, discloseAgents: false };
const shown = { userId: "mate", canAdmin: false, discloseAgents: true };
const self = { userId: "actor", canAdmin: false, discloseAgents: false };
const owner = { userId: "owner", canAdmin: true, discloseAgents: false };

describe("discloseActivity", () => {
  const row = {
    actorId: "actor",
    payload: { agent: "Claude Code", fields: ["title"] },
  };

  it("drops the agent for teammates when disclosure is off", () => {
    expect(discloseActivity(hidden, row).payload).toEqual({
      fields: ["title"],
    });
  });

  it("keeps it when disclosure is on, for the actor and for the owner", () => {
    expect(discloseActivity(shown, row)).toBe(row);
    expect(discloseActivity(self, row)).toBe(row);
    expect(discloseActivity(owner, row)).toBe(row);
  });

  it("leaves human rows alone", () => {
    const human = { actorId: "actor", payload: null };
    expect(discloseActivity(hidden, human)).toBe(human);
  });
});

describe("discloseComment", () => {
  const row = {
    authorId: "actor",
    body: `<p>done</p>${agentFooter("Claude Code")}`,
  };

  it("strips the footer for teammates when disclosure is off", () => {
    expect(discloseComment(hidden, row).body).toBe("<p>done</p>");
  });

  it("keeps it when disclosure is on, for the author and for the owner", () => {
    expect(discloseComment(shown, row)).toBe(row);
    expect(discloseComment(self, row)).toBe(row);
    expect(discloseComment(owner, row)).toBe(row);
  });
});
