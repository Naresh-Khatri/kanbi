export function StatsBar({
  stats,
}: {
  stats: {
    total: number;
    done: number;
    overdue: number;
    unassigned: number;
    highPriority: number;
  };
}) {
  if (stats.total === 0) return null;
  const pct =
    stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-6 py-2 text-xs text-white/70">
      <span>
        <span className="text-white">
          {stats.done}/{stats.total}
        </span>{" "}
        done
        <span className="ml-1 text-white/40">({pct}%)</span>
      </span>
      {stats.overdue > 0 ? (
        <span className="text-rose-300">{stats.overdue} overdue</span>
      ) : null}
      {stats.highPriority > 0 ? (
        <span className="text-amber-300">
          {stats.highPriority} high priority
        </span>
      ) : null}
      {stats.unassigned > 0 ? <span>{stats.unassigned} unassigned</span> : null}
    </div>
  );
}
