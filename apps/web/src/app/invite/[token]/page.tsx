import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { InviteHeader } from "@/components/invite/invite-header";
import { Button } from "@/components/ui/button";
import { Card, CardPanel } from "@/components/ui/card";
import { getSession } from "@/server/better-auth/server";
import { db } from "@/server/db";
import {
  accountExists,
  hasProjectAccess,
  loadInvite,
  sameEmail,
} from "@/server/invites";

import { AcceptInvite } from "./_components/accept-invite";
import { SwitchAccount } from "./_components/switch-account";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [inv, session] = await Promise.all([
    loadInvite(db, token),
    getSession(),
  ]);

  if (!inv) {
    return (
      <Shell>
        <Notice
          body="This invite link is invalid or was revoked. Ask the project owner to send a new one."
          title="Invite not found"
        />
      </Shell>
    );
  }

  const header = (
    <InviteHeader
      invite={{
        projectName: inv.projectName,
        projectColor: inv.projectColor,
        inviterName: inv.inviterName,
        inviterImage: inv.inviterImage,
      }}
    />
  );
  const projectHref = `/app/p/${inv.projectSlug}`;

  // already in -> never re-accept (this is how the owner got demoted before)
  if (
    session?.user &&
    (await hasProjectAccess(db, {
      projectId: inv.projectId,
      ownerId: inv.ownerId,
      userId: session.user.id,
    }))
  ) {
    return (
      <Shell>
        {header}
        <Notice
          action={
            <Button
              className="w-full"
              render={<Link href={projectHref} />}
              size="lg"
            >
              Open {inv.projectName}
            </Button>
          }
          body={`You're signed in as ${session.user.email}, which already has access to this project.`}
          title="You're already a member"
        />
      </Shell>
    );
  }

  if (inv.status !== "valid") {
    return (
      <Shell>
        {header}
        <Notice
          body={
            inv.status === "expired"
              ? `This invite has expired. Ask ${inv.inviterName} to send a new one.`
              : "This invite has already been used. Ask the project owner for a new one if you still need access."
          }
          title={
            inv.status === "expired" ? "Invite expired" : "Invite already used"
          }
        />
      </Shell>
    );
  }

  if (!session?.user) {
    const path = (await accountExists(db, inv.email)) ? "/login" : "/signup";
    redirect(`${path}?invite=${encodeURIComponent(token)}`);
  }

  if (!sameEmail(session.user.email, inv.email)) {
    return (
      <Shell>
        {header}
        <SwitchAccount
          currentEmail={session.user.email}
          invitedEmail={inv.email}
          token={token}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      {header}
      <AcceptInvite
        email={session.user.email}
        image={session.user.image ?? null}
        name={session.user.name}
        projectName={inv.projectName}
        role={inv.role}
        token={token}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell>
      <Card className="w-full max-w-md">
        <CardPanel className="flex flex-col gap-6 sm:p-8">{children}</CardPanel>
      </Card>
    </AuthShell>
  );
}

function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 text-center">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading font-semibold text-lg">{title}</h1>
        <p className="text-pretty text-muted-foreground text-sm">{body}</p>
      </div>
      {action ?? (
        <Button render={<Link href="/app" />} variant="outline">
          Go to dashboard
        </Button>
      )}
    </div>
  );
}
