import { Ban, Clock, EyeOff, SearchX } from "lucide-react";
import Link from "next/link";

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#0b0b0f] to-[#15162c] px-6 text-center text-white">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <Icon className="h-6 w-6 text-white/70" />
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="text-white/60">{body}</p>
      </div>
      <Link
        className="rounded-full bg-white px-6 py-2.5 font-medium text-black transition hover:bg-white/90"
        href="/"
      >
        Go to Kanbi
      </Link>
    </main>
  );
}
