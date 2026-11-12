import { formatDate } from "@kanbi/shared";

import { releases } from "@/changelog";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Changelog" };

export default function ChangelogPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">What&apos;s new</h1>
        <p className="text-muted-foreground text-sm">
          Everything that&apos;s shipped, newest first.
        </p>
      </header>

      <ol className="flex flex-col gap-10">
        {releases.map((release, i) => (
          <li className="flex flex-col gap-3" key={release.version}>
            <div className="flex items-center gap-3 border-b pb-2">
              <h2 className="font-mono text-sm font-medium">
                v{release.version}
              </h2>
              {i === 0 ? <Badge variant="info">Latest</Badge> : null}
              <time
                className="text-muted-foreground ms-auto text-xs"
                dateTime={release.date}
              >
                {/* bare YYYY-MM-DD parses as UTC midnight -> renders a day early west of UTC */}
                {formatDate(`${release.date}T00:00:00`, {
                  relativeDays: false,
                })}
              </time>
            </div>
            <ul className="text-muted-foreground marker:text-muted-foreground/50 flex list-disc flex-col gap-2 ps-5 text-sm">
              {release.entries.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
