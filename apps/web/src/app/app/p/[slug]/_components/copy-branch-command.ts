import { toast } from "sonner";

/** Conventional-commit-ish branch type prefixes. */
export const BRANCH_TYPES = [
  "feat",
  "fix",
  "chore",
  "refactor",
  "docs",
  "test",
] as const;

export type BranchType = (typeof BRANCH_TYPES)[number];

/** Turn an arbitrary title into a clean, lowercase, dash-joined slug. */
function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD") // decompose accents → base char + combining mark
    .replace(/[^a-z0-9]+/g, "-") // combining marks & symbols collapse to dashes
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

/** Guess a branch type from the task's label names (falls back to "feat"). */
export function defaultBranchType(labelNames: string[]): BranchType {
  const haystack = labelNames.join(" ").toLowerCase();
  if (/\b(bug|fix|hotfix|defect|regression)\b/.test(haystack)) return "fix";
  if (/\b(chore|maintenance|infra|deps?|dependency)\b/.test(haystack))
    return "chore";
  if (/\b(docs?|documentation)\b/.test(haystack)) return "docs";
  if (/\b(refactor|cleanup|tech-?debt)\b/.test(haystack)) return "refactor";
  if (/\b(test|tests|testing|qa)\b/.test(haystack)) return "test";
  return "feat";
}

type BranchArgs = {
  number: number;
  title: string;
  type: BranchType;
};

/** Build a structured branch name, e.g. `feat/12-add-login-button`. */
export function buildBranchName({ number, title, type }: BranchArgs) {
  const slug = slugify(title);
  return slug ? `${type}/${number}-${slug}` : `${type}/${number}`;
}

/** Build the full "start a task" command block. */
export function buildBranchCommand(args: BranchArgs) {
  const branch = buildBranchName(args);
  return [
    "git fetch origin",
    "git switch main",
    "git pull",
    `git switch -c ${branch}`,
  ].join("\n");
}

function copy(text: string, success: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(success),
    () => toast.error("Couldn't copy to clipboard"),
  );
}

/** Copy the fetch/sync/branch command block for a task. */
export function copyBranchCommand(args: BranchArgs) {
  copy(buildBranchCommand(args), "Branch command copied");
}

/** Copy just the branch name. */
export function copyBranchName(args: BranchArgs) {
  copy(buildBranchName(args), "Branch name copied");
}
