import { LockIcon } from "lucide-react";

import { InviteHeader } from "@/components/invite/invite-header";
import { Alert } from "@/components/ui/alert";
import type { AuthInvite } from "@/server/invites";

export const inviteReturnPath = (invite: AuthInvite) =>
  `/invite/${encodeURIComponent(invite.token)}`;

export function AuthInviteBanner({ invite }: { invite: AuthInvite }) {
  return (
    <Alert>
      <InviteHeader compact invite={invite} />
    </Alert>
  );
}

export function InvitedEmailHint({ providers }: { providers: string[] }) {
  return (
    <span className="flex items-start gap-1.5">
      <LockIcon aria-hidden="true" className="mt-px size-3 shrink-0" />
      <span>
        Locked to the invited email.
        {providers.length > 0
          ? ` ${providers.join(" or ")} works too if it uses this email.`
          : null}
      </span>
    </span>
  );
}
