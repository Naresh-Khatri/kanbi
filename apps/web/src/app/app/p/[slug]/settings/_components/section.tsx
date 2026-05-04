import type { ReactNode } from "react";

export function Section({
  id,
  title,
  description,
  children,
  tone = "default",
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      className={`scroll-mt-20 rounded-xl border ${
        tone === "danger"
          ? "border-red-500/30 bg-red-500/[0.03]"
          : "border-white/10 bg-white/[0.02]"
      } p-6`}
      id={id}
    >
      <div className="mb-4">
        <h2
          className={`text-base font-semibold ${
            tone === "danger" ? "text-red-300" : "text-white"
          }`}
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-white/60">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
