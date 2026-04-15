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
			{ keys: "?", description: "Show this cheatsheet" },
		],
	},
	{
		title: "Create",
		entries: [
			{ keys: "C", description: "New project" },
			{ keys: "c", description: "New task (on board)" },
		],
	},
];
