"use client";

import { LastUsedBadge, type LastUsedProvider } from "@/components/auth/last-used";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/server/better-auth/client";

const SOCIAL = [
  { id: "github", label: "GitHub" },
  { id: "google", label: "Google" },
] as const;

export function socialProviderNames(providers: {
  github: boolean;
  google: boolean;
}) {
  return SOCIAL.filter((p) => providers[p.id]).map((p) => p.label);
}

/** github/google buttons + "or" rule; renders nothing when none are enabled */
export function SocialAuth({
  providers,
  callbackURL,
  lastUsed,
  mark,
}: {
  providers: { github: boolean; google: boolean };
  callbackURL: string;
  lastUsed: LastUsedProvider | null;
  mark: (provider: LastUsedProvider) => void;
}) {
  const enabled = SOCIAL.filter((p) => providers[p.id]);
  if (enabled.length === 0) return null;

  async function onSocial(provider: (typeof SOCIAL)[number]["id"]) {
    mark(provider);
    await authClient.signIn.social({ provider, callbackURL });
  }

  return (
    <>
      <div className="flex gap-3">
        {enabled.map((p) => (
          <div className="relative flex-1" key={p.id}>
            {lastUsed === p.id && <LastUsedBadge />}
            <Button
              className="w-full"
              onClick={() => onSocial(p.id)}
              size="lg"
              type="button"
              variant="outline"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="size-4" src={`/icons/${p.id}.svg`} />
              {p.label}
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 text-muted-foreground text-xs">
        <Separator className="flex-1" />
        or
        <Separator className="flex-1" />
      </div>
    </>
  );
}
