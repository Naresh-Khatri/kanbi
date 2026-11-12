"use client";

import {
  ArrowUpIcon,
  FileTextIcon,
  PanelRightCloseIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/trpc/react";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function AskDocsPanel({
  projectId,
  slug,
  currentDocumentId,
  disabled,
}: {
  projectId: string;
  slug: string;
  currentDocumentId?: string;
  disabled: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null);
  const ask = api.document.ask.useMutation({
    onError: (error) =>
      toastManager.add({ type: "error", title: error.message }),
  });

  const submit = () => {
    const trimmed = question.trim();
    if (trimmed.length < 2 || ask.isPending || disabled) return;
    ask.reset();
    setAskedQuestion(trimmed);
    setQuestion("");
    ask.mutate({ projectId, question: trimmed, currentDocumentId });
  };

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {!expanded ? (
        <motion.div
          animate={{ opacity: 1, transform: "translateY(0) scale(1)" }}
          className="fixed end-5 bottom-5 z-40"
          exit={{
            opacity: 0,
            transform: reduceMotion
              ? "translateY(0) scale(1)"
              : "translateY(4px) scale(0.97)",
            transition: { duration: 0.1, ease: EASE_OUT },
          }}
          initial={{
            opacity: 0,
            transform: reduceMotion
              ? "translateY(0) scale(1)"
              : "translateY(6px) scale(0.97)",
          }}
          key="ask-docs-trigger"
          transition={{ duration: 0.16, ease: EASE_OUT }}
        >
          <Button
            className="shadow-md"
            onClick={() => setExpanded(true)}
            size="sm"
            variant="outline"
          >
            <SparklesIcon aria-hidden="true" className="text-ai-foreground" />
            Ask docs
          </Button>
        </motion.div>
      ) : (
        <motion.aside
          animate={{ opacity: 1, transform: "translateX(0)" }}
          aria-label="Ask docs"
          className="bg-background flex w-full shrink-0 flex-col border-t max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:h-[70svh] max-md:rounded-t-xl max-md:shadow-lg md:h-auto md:w-80 md:border-s md:border-t-0 xl:w-96"
          exit={{
            opacity: 0,
            transform: reduceMotion ? "translateX(0)" : "translateX(16px)",
            transition: { duration: 0.16, ease: EASE_OUT },
          }}
          initial={{
            opacity: 0,
            transform: reduceMotion ? "translateX(0)" : "translateX(24px)",
          }}
          key="ask-docs-panel"
          transition={{ duration: 0.22, ease: EASE_OUT }}
        >
          <header className="flex h-11 shrink-0 items-center justify-between border-b px-3">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <SparklesIcon
                aria-hidden="true"
                className="text-ai-foreground size-3.5"
              />
              Ask docs
            </h2>
            <div className="flex items-center gap-0.5">
              {askedQuestion ? (
                <IconAction
                  label="Clear conversation"
                  onClick={() => {
                    setAskedQuestion(null);
                    ask.reset();
                  }}
                >
                  <XIcon aria-hidden="true" />
                </IconAction>
              ) : null}
              <IconAction label="Close" onClick={() => setExpanded(false)}>
                <PanelRightCloseIcon aria-hidden="true" />
              </IconAction>
            </div>
          </header>

          <ScrollArea className="flex-1" scrollFade>
            <div aria-live="polite" className="flex min-h-full flex-col p-4">
              {askedQuestion ? (
                <>
                  <div className="flex justify-end ps-8">
                    <p className="bg-muted max-w-[90%] rounded-lg px-3 py-2 text-sm">
                      {askedQuestion}
                    </p>
                  </div>
                  <div className="mt-4 flex items-start gap-2.5">
                    <SparklesIcon
                      aria-hidden="true"
                      className="text-ai-foreground mt-1 size-3.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      {ask.isPending ? (
                        <p className="text-muted-foreground flex items-center gap-2 text-sm">
                          <Spinner className="size-3.5" />
                          Looking through project docs…
                        </p>
                      ) : ask.data ? (
                        <>
                          <p className="text-sm leading-6 whitespace-pre-wrap">
                            {ask.data.answer}
                          </p>
                          {ask.data.citations.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {ask.data.citations.map((citation) => (
                                <Button
                                  className="max-w-full"
                                  key={citation.documentId}
                                  render={
                                    <Link
                                      href={`/app/p/${slug}/docs/${citation.documentId}`}
                                    />
                                  }
                                  size="xs"
                                  variant="outline"
                                >
                                  <FileTextIcon aria-hidden="true" />
                                  <span className="truncate">
                                    {citation.title}
                                  </span>
                                </Button>
                              ))}
                            </div>
                          ) : null}
                        </>
                      ) : ask.error ? (
                        <p className="text-muted-foreground text-sm">
                          I couldn&apos;t answer that right now. Try again in a
                          moment.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <Empty className="px-2 md:py-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SparklesIcon aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyDescription className="text-sm">
                      {disabled
                        ? "Create a page before asking project docs."
                        : "Ask a question and get an answer grounded in project pages."}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t p-3">
            <InputGroup>
              <InputGroupTextarea
                aria-label="Ask project docs"
                className="max-h-32"
                disabled={disabled || ask.isPending}
                maxLength={500}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
                placeholder={
                  disabled ? "Create a page to ask docs" : "Ask project docs…"
                }
                rows={3}
                value={question}
              />
              <InputGroupAddon align="block-end" className="justify-between">
                <InputGroupText className="text-xs">
                  Answers cite project pages.
                </InputGroupText>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        aria-label="Ask"
                        disabled={
                          disabled ||
                          ask.isPending ||
                          question.trim().length < 2
                        }
                        onClick={submit}
                        size="icon-xs"
                      />
                    }
                  >
                    {ask.isPending ? (
                      <Spinner />
                    ) : (
                      <ArrowUpIcon aria-hidden="true" />
                    )}
                  </TooltipTrigger>
                  <TooltipPopup>
                    Ask <Kbd>Enter</Kbd>
                  </TooltipPopup>
                </Tooltip>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            onClick={onClick}
            size="icon-xs"
            variant="ghost"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}
