import {
  type Priority,
  PriorityIcon,
} from "@/app/app/p/[slug]/_components/priority";
import { Dot } from "@/components/ui/badge";
import { Card } from "@/components/ui/surface";

type DotTone = "bg-info" | "bg-success" | "bg-ai" | "bg-warning";
type FakeCard = {
  id: string;
  title: string;
  priority: Priority;
  dot: DotTone;
};

const COLUMNS: { name: string; cards: FakeCard[] }[] = [
  {
    name: "Backlog",
    cards: [
      {
        id: "KB-14",
        title: "Export board as CSV",
        priority: "low",
        dot: "bg-info",
      },
      {
        id: "KB-17",
        title: "Dark mode for emails",
        priority: "none",
        dot: "bg-ai",
      },
    ],
  },
  {
    name: "In progress",
    cards: [
      {
        id: "KB-9",
        title: "Fix drag on touch devices",
        priority: "urgent",
        dot: "bg-warning",
      },
      {
        id: "KB-12",
        title: "Keyboard shortcut help",
        priority: "medium",
        dot: "bg-info",
      },
      {
        id: "KB-15",
        title: "Invite teammates",
        priority: "high",
        dot: "bg-success",
      },
    ],
  },
  {
    name: "Done",
    cards: [
      {
        id: "KB-3",
        title: "Set up projects",
        priority: "medium",
        dot: "bg-success",
      },
      { id: "KB-6", title: "Add task labels", priority: "low", dot: "bg-ai" },
    ],
  },
];

/** decorative only: static fake data, hidden from assistive tech */
export function BoardPreview() {
  return (
    <Card
      aria-hidden="true"
      className="w-full max-w-4xl"
      padding="sm"
      tone="raised"
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {COLUMNS.map((col) => (
          <div className="flex flex-col gap-2" key={col.name}>
            <div className="flex items-center gap-2 px-1 py-1 text-xs font-medium text-white/70">
              {col.name}
              <span className="text-white/40">{col.cards.length}</span>
            </div>
            {col.cards.map((c) => (
              <Card
                className="flex flex-col gap-2 text-left"
                key={c.id}
                padding="sm"
                radius="md"
                tone="muted"
              >
                <span className="text-xs leading-snug text-white">
                  {c.title}
                </span>
                <span className="text-2xs flex items-center gap-1.5 text-white/40">
                  <PriorityIcon className="h-3 w-3" priority={c.priority} />
                  {c.id}
                  <Dot className={"ml-auto " + c.dot} size="xs" />
                </span>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
