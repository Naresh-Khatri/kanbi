import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import {
  InviteHeader,
  type InviteSummary,
} from "@/components/invite/invite-header";
import { Button } from "@/components/ui/button";
import { Card, CardPanel } from "@/components/ui/card";
import { getSession } from "@/server/better-auth/server";
import { db } from "@/server/db";
import {
  accountExists,
  hasProjectAccess,
  type InviteLinkStatus,
  loadInvite,
  loadInviteLink,
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
    const link = await loadInviteLink(db, token);
    if (link)
      return <LinkInvitePage link={link} session={session} token={token} />;
    return (
      <Shell>
        <Notice
          body="This invite link is invalid or was revoked. Ask the project owner to send a new one."
          title="Invite not found"
        />
      </Shell>
    );
  }

  const header = <InviteHeader invite={inv} />;
  // already in -> never re-accept (this is how the owner got demoted before)
  const member = await alreadyMember(inv, session);
  if (member) return member;

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
        kind="email"
        name={session.user.name}
        projectName={inv.projectName}
        role={inv.role}
        token={token}
      />
    </Shell>
  );
}

type Session = Awaited<ReturnType<typeof getSession>>;

async function alreadyMember(
  target: InviteSummary & {
    projectId: string;
    projectSlug: string;
    ownerId: string;
  },
  session: Session,
) {
  if (
    !session?.user ||
    !(await hasProjectAccess(db, {
      projectId: target.projectId,
      ownerId: target.ownerId,
      userId: session.user.id,
    }))
  ) {
    return null;
  }
  return (
    <Shell>
      <InviteHeader invite={target} />
      <Notice
        action={
          <Button
            className="w-full"
            render={<Link href={`/app/p/${target.projectSlug}`} />}
            size="lg"
          >
            Open {target.projectName}
          </Button>
        }
        body={`You're signed in as ${session.user.email}, which already has access to this project.`}
        title="You're already a member"
      />
    </Shell>
  );
}

const LINK_NOTICE: Record<
  Exclude<InviteLinkStatus, "valid">,
  { title: string; body: (inviter: string) => string }
> = {
  expired: {
    title: "Invite link expired",
    body: (n) => `This invite link has expired. Ask ${n} for a new one.`,
  },
  revoked: {
    title: "Invite link turned off",
    body: (n) =>
      `This invite link is no longer active. Ask ${n} for a new one.`,
  },
  full: {
    title: "Invite link is full",
    body: (n) =>
      `Everyone this link was meant for has already joined. Ask ${n} for a new one.`,
  },
};

async function LinkInvitePage({
  link,
  session,
  token,
}: {
  link: NonNullable<Awaited<ReturnType<typeof loadInviteLink>>>;
  session: Session;
  token: string;
}) {
  const header = <InviteHeader invite={link} />;
  const member = await alreadyMember(link, session);
  if (member) return member;

  if (link.status !== "valid") {
    const notice = LINK_NOTICE[link.status];
    return (
      <Shell>
        {header}
        <Notice body={notice.body(link.inviterName)} title={notice.title} />
      </Shell>
    );
  }

  // shared in a group -> most people are new; signup links to login
  if (!session?.user) redirect(`/signup?invite=${encodeURIComponent(token)}`);

  return (
    <Shell>
      {header}
      <AcceptInvite
        email={session.user.email}
        image={session.user.image ?? null}
        kind="link"
        name={session.user.name}
        projectName={link.projectName}
        role={link.role}
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
        <h1 className="font-heading text-lg font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm text-pretty">{body}</p>
      </div>
      {action ?? (
        <Button render={<Link href="/app" />} variant="outline">
          Go to dashboard
        </Button>
      )}
    </div>
  );
}
