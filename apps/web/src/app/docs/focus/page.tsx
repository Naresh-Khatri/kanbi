import type { Metadata } from "next";
import Link from "next/link";

import { CodeBlock } from "../_components/code-block";

export const metadata: Metadata = {
  title: "Focus companion app · Kanbi",
  description:
    "A landscape companion for your phone or tablet: see your boards, pick an active task, and run a focus timer. Pairs to your account over a QR code.",
};

const STEPS = [
  {
    title: "Run the app",
    body: (
      <>
        Focus ships in the repo as an Expo app. Start it in dev with{" "}
        <code>pnpm dev:focus</code>, or build it for your device with EAS. It runs
        in landscape and is happiest on a spare phone or tablet on your desk.
      </>
    ),
  },
  {
    title: "Open Settings → Devices on the web",
    body: (
      <>
        In Kanbi, go to{" "}
        <Link
          className="text-white underline underline-offset-4 transition hover:text-white/80"
          href="/app/profile"
        >
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
        device and you&apos;re connected — no password typed on the small screen.
      </>
    ),
  },
] as const;

export default function FocusDocsPage() {
  return (
    <article>
      <p className="text-sm font-medium text-white/40">Focus companion app</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
        Your boards on a second screen
      </h1>
      <p className="mt-3 text-lg text-white/70">
        A landscape companion for a phone or tablet: see your boards, pick an
        active task, and run a focus timer beside your work. It pairs to your
        account over a QR code — each device gets its own token you can revoke.
      </p>

      <h2 className="mt-12 text-lg font-semibold tracking-tight">Get started</h2>
      <ol className="mt-4 flex flex-col gap-4">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3.5"
          >
            <span className="font-mono text-sm text-white/40">{i + 1}</span>
            <div>
              <p className="font-medium text-white">{step.title}</p>
              <p className="mt-1 text-sm text-white/70">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="mt-12 text-lg font-semibold tracking-tight">
        Run it locally
      </h2>
      <p className="mt-2 text-sm text-white/70">
        From the repo root:
      </p>
      <div className="mt-3">
        <CodeBlock code={`pnpm dev:focus`} />
      </div>
      <p className="mt-3 text-sm text-white/50">
        Point the device at the same network as your Kanbi server when pairing in
        dev — the QR encodes a LAN-reachable host.
      </p>
    </article>
  );
}
