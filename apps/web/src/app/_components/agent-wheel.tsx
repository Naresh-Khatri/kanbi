"use client";

import { useEffect, useState } from "react";

import { AgentLogo } from "@/components/agent-logo";
import type { AgentId } from "@/lib/agents";

const STEP_MS = 2000;
// em of the h1: icon ~ cap height, sits on the baseline like a letter
const SIZE = 0.8;
const RADIUS = 1.3;
// back-out = small overshoot, reads as a detent snap
const SNAP = "transform 500ms cubic-bezier(0.34, 1.4, 0.64, 1)";
const FADE = "opacity 300ms cubic-bezier(0.23, 1, 0.32, 1)";

/** Inline hero glyph: agent icons on a wheel centered off to the right, snapping one step at a time. */
export function AgentWheel({ agents }: { agents: AgentId[] }) {
  // never wraps -> wheel keeps turning the same way
  const [tick, setTick] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) setTick((t) => t + 1);
    }, STEP_MS);
    return () => clearInterval(id);
  }, []);

  const n = agents.length;
  const step = 360 / n;
  // + turn with icons laid out counter-clockwise -> next one rises from below
  const wheel = tick * step;
  const active = tick % n;
  // reduced motion -> wheel jumps, icons only crossfade
  const snap = reduced ? "transform 0s" : SNAP;

  return (
    <span
      aria-hidden="true"
      className="relative inline-block align-[-0.04em]"
      style={{ width: `${SIZE}em`, height: `${SIZE}em` }}
    >
      {/* h1 line-height = 1em -> tight window, icons roll through without touching other lines */}
      <span
        className="absolute overflow-hidden mask-[linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]"
        style={{
          top: "-0.15em",
          bottom: "-0.15em",
          left: "-0.15em",
          right: "-0.75em",
        }}
      >
        <span
          className="absolute top-1/2 size-0"
          style={{
            left: `calc(0.15em + ${SIZE / 2 + RADIUS}em)`,
            transform: `rotate(${wheel}deg)`,
            transition: snap,
          }}
        >
          {agents.map((agent, i) => {
            const angle = 180 - i * step;
            return (
              <span
                className="absolute top-0 left-0 size-0"
                key={agent}
                style={{
                  transform: `rotate(${angle}deg) translateX(${RADIUS}em)`,
                }}
              >
                <span
                  className="absolute top-0 left-0"
                  style={{
                    width: `${SIZE}em`,
                    height: `${SIZE}em`,
                    // counter-rotate with the same curve -> icons stay upright mid-snap
                    transform: `translate(-50%, -50%) rotate(${-(angle + wheel)}deg)`,
                    transition: `${snap}, ${FADE}`,
                    opacity: i === active ? 1 : 0,
                  }}
                >
                  <AgentLogo agent={agent} className="size-full" />
                </span>
              </span>
            );
          })}
        </span>
      </span>
    </span>
  );
}
