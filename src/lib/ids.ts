import { customAlphabet, nanoid } from "nanoid";

export { nanoid };

/** URL-safe, lowercase + digits — used for share tokens. */
export const shareToken = customAlphabet(
	"abcdefghijklmnopqrstuvwxyz0123456789",
	24,
);

/** Short human-friendly slug fragment when auto-generating project slugs. */
export const slugSuffix = customAlphabet(
	"abcdefghijklmnopqrstuvwxyz0123456789",
	6,
);

export function slugify(name: string) {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}
