import { Lock } from "lucide-react";

import { Card } from "@/components/ui/surface";
import { InviteHeader } from "@/components/invite/invite-header";
import type { AuthInvite } from "@/server/invites";

export const inviteReturnPath = (invite: AuthInvite) =>
  `/invite/${encodeURIComponent(invite.token)}`;

export function AuthInviteBanner({ invite }: { invite: AuthInvite }) {
  return (
    <Card tone="muted">
      <InviteHeader compact invite={invite} />
    </Card>
  );
}

export function InvitedEmailHint({ providers }: { providers: string[] }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-white/40">
      <Lock className="mt-px h-3 w-3 shrink-0" />
      <span>
        Locked to the invited email.
        {providers.length > 0
          ? ` ${providers.join(" or ")} works too if it uses this email.`
          : null}
      </span>
    </p>
  );
}
