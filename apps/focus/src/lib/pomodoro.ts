import { useEffect, useRef, useState } from "react";

export type PomodoroPhase = "focus" | "short-break" | "long-break";
export type PomodoroState = "idle" | "running" | "paused";

export interface PomodoroSnapshot {
  phase: PomodoroPhase;
  state: PomodoroState;
  remainingMs: number;
  totalMs: number;
  cyclesCompleted: number;
}

const FOCUS_MS = 25 * 60 * 1000;
const SHORT_BREAK_MS = 5 * 60 * 1000;
const LONG_BREAK_MS = 15 * 60 * 1000;
const CYCLES_BEFORE_LONG = 4;

function durationFor(phase: PomodoroPhase) {
  if (phase === "focus") return FOCUS_MS;
  if (phase === "short-break") return SHORT_BREAK_MS;
  return LONG_BREAK_MS;
}

function nextPhase(
  current: PomodoroPhase,
  cyclesCompleted: number,
): { phase: PomodoroPhase; cyclesCompleted: number } {
  if (current === "focus") {
    const next = cyclesCompleted + 1;
    return {
      phase: next % CYCLES_BEFORE_LONG === 0 ? "long-break" : "short-break",
      cyclesCompleted: next,
    };
  }
  return { phase: "focus", cyclesCompleted };
}

export function usePomodoro(onPhaseChange?: (phase: PomodoroPhase) => void) {
  const [phase, setPhase] = useState<PomodoroPhase>("focus");
  const [state, setState] = useState<PomodoroState>("idle");
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [remainingMs, setRemainingMs] = useState(durationFor("focus"));
  const targetRef = useRef<number | null>(null);

  useEffect(() => {
    if (state !== "running") return;
    const tick = () => {
      const target = targetRef.current;
      if (target == null) return;
      const left = Math.max(0, target - Date.now());
      setRemainingMs(left);
      if (left === 0) {
        const advanced = nextPhase(phase, cyclesCompleted);
        setPhase(advanced.phase);
        setCyclesCompleted(advanced.cyclesCompleted);
        const dur = durationFor(advanced.phase);
        targetRef.current = Date.now() + dur;
        setRemainingMs(dur);
        onPhaseChange?.(advanced.phase);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [state, phase, cyclesCompleted, onPhaseChange]);

  const start = () => {
    targetRef.current = Date.now() + remainingMs;
    setState("running");
  };

  const pause = () => {
    if (targetRef.current != null) {
      setRemainingMs(Math.max(0, targetRef.current - Date.now()));
    }
    targetRef.current = null;
    setState("paused");
  };

  const reset = () => {
    targetRef.current = null;
    setState("idle");
    setRemainingMs(durationFor(phase));
  };

  const skip = () => {
    const advanced = nextPhase(phase, cyclesCompleted);
    setPhase(advanced.phase);
    setCyclesCompleted(advanced.cyclesCompleted);
    const dur = durationFor(advanced.phase);
    setRemainingMs(dur);
    if (state === "running") targetRef.current = Date.now() + dur;
    onPhaseChange?.(advanced.phase);
  };

  const snapshot: PomodoroSnapshot = {
    phase,
    state,
    remainingMs,
    totalMs: durationFor(phase),
    cyclesCompleted,
  };

  return { ...snapshot, start, pause, reset, skip };
}

export function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
