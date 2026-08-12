import { formatDate } from "@kanbi/shared";

import { releases } from "@/changelog";

export const metadata = { title: "Changelog" };

export default function ChangelogPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-10">
      <h1 className="text-lg font-semibold tracking-tight">Changelog</h1>
      <p className="mt-1 text-sm text-white/40">
        Everything that&apos;s shipped, newest first.
      </p>

      <div className="mt-8 flex flex-col gap-8">
        {releases.map((release) => (
          <section key={release.version}>
            <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-2">
              <h2 className="font-mono text-sm">v{release.version}</h2>
              <time className="text-xs text-white/40" dateTime={release.date}>
                {/* bare YYYY-MM-DD parses as UTC midnight -> renders a day early west of UTC */}
                {formatDate(`${release.date}T00:00:00`, { relativeDays: false })}
              </time>
            </div>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-white/70">
              {release.entries.map((entry) => (
                <li className="flex gap-2" key={entry}>
                  <span aria-hidden className="text-white/25">
                    —
                  </span>
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
