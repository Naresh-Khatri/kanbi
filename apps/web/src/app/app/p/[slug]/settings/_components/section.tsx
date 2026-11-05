import type { ReactNode } from "react";

import { Card } from "@/components/ui/surface";

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
    <Card
      as="section"
      className="scroll-mt-20"
      id={id}
      padding="lg"
      tone={tone === "danger" ? "danger" : "flat"}
    >
      <div className="mb-4">
        <h2
          className={`text-base font-semibold ${
            tone === "danger" ? "text-danger" : "text-white"
          }`}
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-white/70">{description}</p>
        ) : null}
      </div>
      {children}
    </Card>
  );
}
