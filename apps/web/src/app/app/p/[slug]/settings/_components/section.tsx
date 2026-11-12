import type { FormEventHandler, ReactNode } from "react";

import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { cn } from "@/lib/utils";

// children = CardPanel / CardFooter, kept as direct Card children;
// onSubmit turns the card itself into the form so slot selectors still match
export function Section({
  id,
  title,
  description,
  action,
  children,
  tone = "default",
  onSubmit,
  className,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  tone?: "default" | "danger";
  onSubmit?: FormEventHandler<HTMLFormElement>;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        tone === "danger" && "border-destructive/32",
        className,
      )}
      id={id}
      render={
        onSubmit ? (
          <Form aria-labelledby={`${id}-title`} onSubmit={onSubmit} />
        ) : (
          <section aria-labelledby={`${id}-title`} />
        )
      }
    >
      <CardHeader>
        <CardTitle
          className={cn(
            "text-base",
            tone === "danger" && "text-destructive-foreground",
          )}
          id={`${id}-title`}
          render={<h2 />}
        >
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      {children}
    </Card>
  );
}
