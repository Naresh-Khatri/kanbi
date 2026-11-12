import type * as React from "react";

export function DocsHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <p className="font-medium text-muted-foreground text-sm">{eyebrow}</p>
      <h1 className="text-balance font-heading font-semibold text-3xl tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="text-pretty text-lg text-muted-foreground">{children}</p>
    </header>
  );
}

/** h2 + body; direct <p> children get muted body type */
export function DocsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 flex flex-col gap-3 *:[p]:text-muted-foreground *:[p]:text-sm/6">
      <h2 className="font-heading font-semibold text-xl tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}
