import { BanIcon, ClockIcon, EyeOffIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export type ShareStatus = "revoked" | "expired" | "exhausted" | "not_found";

const COPY: Record<
  ShareStatus,
  { Icon: typeof BanIcon; title: string; body: string }
> = {
  revoked: {
    Icon: BanIcon,
    title: "This link was turned off",
    body: "The board owner revoked this share link.",
  },
  expired: {
    Icon: ClockIcon,
    title: "This link has expired",
    body: "Ask the board owner for a fresh share link.",
  },
  exhausted: {
    Icon: EyeOffIcon,
    title: "This link reached its view limit",
    body: "Ask the board owner for a new share link.",
  },
  not_found: {
    Icon: SearchXIcon,
    title: "Board not found",
    body: "This share link is invalid or no longer exists.",
  },
};

export function ShareUnavailable({ status }: { status: ShareStatus }) {
  const { Icon, title, body } = COPY[status];
  return (
    <AuthShell>
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{body}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/" />} size="lg">
            Go to Kanbi
          </Button>
        </EmptyContent>
      </Empty>
    </AuthShell>
  );
}
