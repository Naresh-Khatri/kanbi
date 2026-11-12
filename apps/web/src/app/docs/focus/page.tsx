import type { Metadata } from "next";
import Link from "next/link";

import { CodeBlock } from "../_components/code-block";
import { DocsHero, DocsSection } from "../_components/docs-page";

export const metadata: Metadata = {
  title: "Focus companion app · Kanbi",
  description:
    "A landscape companion for your phone or tablet: see your boards, pick an active task, and run a focus timer. Pairs to your account over a QR code.",
};

const LINK =
  "font-medium text-foreground underline underline-offset-4 hover:no-underline";

const STEPS = [
  {
    title: "Run the app",
    body: (
      <>
        Focus ships in the repo as an Expo app. Start it in dev with{" "}
        <code>pnpm dev:focus</code>, or build it for your device with EAS. It
        runs in landscape and is happiest on a spare phone or tablet on your
        desk.
      </>
    ),
  },
  {
    title: "Open Settings → Devices on the web",
    body: (
      <>
        In Kanbi, go to{" "}
        <Link className={LINK} href="/app/profile">
          Profile → Devices
        </Link>{" "}
        and issue a device. A QR code appears, backed by a per-device token you
        can revoke at any time.
      </>
    ),
  },
  {
    title: "Scan to pair",
    body: (
      <>
        Point the app&apos;s camera at the QR code. It stores the token on the
        device and you&apos;re connected — no password typed on the small
        screen.
      </>
    ),
  },
] as const;

export default function FocusDocsPage() {
  return (
    <article>
      <DocsHero eyebrow="Focus companion app" title="Your boards on a second screen">
        A landscape companion for a phone or tablet: see your boards, pick an
        active task, and run a focus timer beside your work. It pairs to your
        account over a QR code — each device gets its own token you can revoke.
      </DocsHero>

      <DocsSection title="Get started">
        <ol className="flex flex-col">
          {STEPS.map((step, i) => (
            <li className="relative flex gap-4 pb-6 last:pb-0" key={step.title}>
              {i < STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute start-3 top-8 bottom-1 w-px bg-border"
                />
              ) : null}
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-card font-medium text-muted-foreground text-xs tabular-nums">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1 pt-0.5">
                <p className="font-medium text-sm">{step.title}</p>
                <p className="text-muted-foreground text-sm/6">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </DocsSection>

      <DocsSection title="Run it locally">
        <p>From the repo root:</p>
        <CodeBlock code="pnpm dev:focus" />
        <p>
          Point the device at the same network as your Kanbi server when
          pairing in dev — the QR encodes a LAN-reachable host.
        </p>
      </DocsSection>
    </article>
  );
}
