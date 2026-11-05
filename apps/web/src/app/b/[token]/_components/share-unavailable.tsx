import { Ban, Clock, EyeOff, SearchX } from "lucide-react";
import { IconTile } from "@/components/ui/surface";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export type ShareStatus = "revoked" | "expired" | "exhausted" | "not_found";

const COPY: Record<
  ShareStatus,
  { Icon: typeof Ban; title: string; body: string }
> = {
  revoked: {
    Icon: Ban,
    title: "This link was turned off",
    body: "The board owner revoked this share link.",
  },
  expired: {
    Icon: Clock,
    title: "This link has expired",
    body: "Ask the board owner for a fresh share link.",
  },
  exhausted: {
    Icon: EyeOff,
    title: "This link reached its view limit",
    body: "Ask the board owner for a new share link.",
  },
  not_found: {
    Icon: SearchX,
    title: "Board not found",
    body: "This share link is invalid or no longer exists.",
  },
};

export function ShareUnavailable({ status }: { status: ShareStatus }) {
  const { Icon, title, body } = COPY[status];
  return (
    <main className="bg-marketing flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center text-white">
      <IconTile shape="round" size="lg">
        <Icon className="h-6 w-6" />
      </IconTile>
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="text-white/70">{body}</p>
      </div>
      <Button asChild shape="pill" size="lg">
        <Link href="/">Go to Kanbi</Link>
      </Button>
    </main>
  );
}
