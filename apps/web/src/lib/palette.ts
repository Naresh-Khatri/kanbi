// data palettes: user-pickable colours stored in db, not ui chrome

export const DEFAULT_PROJECT_COLOR = "#6366f1";

export const PROJECT_COLORS = [
  DEFAULT_PROJECT_COLOR,
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#14b8a6",
  "#ec4899",
] as const;

export const LABEL_COLORS = [
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
] as const;

export const DEFAULT_LABELS = [
  { name: "Bug", color: "#f43f5e" },
  { name: "Feature", color: "#3b82f6" },
  { name: "Improvement", color: "#10b981" },
  { name: "Design", color: "#8b5cf6" },
] as const;

export const CONFETTI_COLORS = [
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#fbbf24",
  "#34d399",
];
