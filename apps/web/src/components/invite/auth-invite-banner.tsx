import { Lock } from "lucide-react";

import { InviteHeader } from "@/components/invite/invite-header";
import type { AuthInvite } from "@/server/invites";

export const inviteReturnPath = (invite: AuthInvite) =>
  `/invite/${encodeURIComponent(invite.token)}`;

export function AuthInviteBanner({ invite }: { invite: AuthInvite }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <InviteHeader compact invite={invite} />
    </div>
  );
}

export function InvitedEmailHint({ providers }: { providers: string[] }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-white/50">
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
