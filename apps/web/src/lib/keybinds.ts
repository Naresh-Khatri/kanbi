export type KeybindGroup = {
  title: string;
  entries: { keys: string; description: string }[];
};

export const KEYBIND_GROUPS: KeybindGroup[] = [
  {
    title: "Navigation",
    entries: [
      { keys: "⌘K / Ctrl+K", description: "Open command palette" },
      { keys: "g then h", description: "Go to dashboard" },
      {
        keys: "g then 1-9 / Alt+1-9",
        description: "Jump to Nth active project",
      },
      { keys: "?", description: "Show this cheatsheet" },
    ],
  },
  {
    title: "Create",
    entries: [
      { keys: "C", description: "New project" },
      { keys: "c", description: "New task (on board)" },
      { keys: "V", description: "Draft tasks with AI" },
    ],
  },
  {
    title: "Board",
    entries: [
      { keys: "/", description: "Focus task search" },
      { keys: "↑ ↓ ← →", description: "Move between cards" },
      { keys: "Shift + arrows", description: "Extend card selection" },
      { keys: "Enter / e", description: "Open focused card" },
      { keys: "x", description: "Select focused card" },
      { keys: "Esc", description: "Clear card selection" },
    ],
  },
];
