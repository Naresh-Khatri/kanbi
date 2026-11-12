"use client";

import {
  ChevronRightIcon,
  EllipsisIcon,
  FilePlus2Icon,
  FileTextIcon,
  FolderInputIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@/trpc/react";
import { buildTree, type DocumentList, type DocumentNode } from "./tree";

type TreeActions = {
  slug: string;
  activeId?: string;
  canWrite: boolean;
  onCreate: (parentId: string | null) => void;
  onMove: (documentId: string) => void;
};

export function DocsTree({
  documents,
  query,
  setQuery,
  searchResults,
  creating,
  ...actions
}: TreeActions & {
  documents: DocumentList;
  query: string;
  setQuery: (value: string) => void;
  searchResults: RouterOutputs["document"]["search"] | null;
  creating: boolean;
}) {
  const tree = useMemo(() => buildTree(documents), [documents]);

  return (
    <aside className="bg-sidebar flex max-h-72 w-full shrink-0 flex-col border-b md:max-h-none md:w-64 md:border-e md:border-b-0">
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <h2 className="text-sm font-medium">Pages</h2>
        {actions.canWrite ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="New page"
                  disabled={creating}
                  onClick={() => actions.onCreate(null)}
                  size="icon-xs"
                  variant="ghost"
                />
              }
            >
              {creating ? <Spinner /> : <PlusIcon aria-hidden="true" />}
            </TooltipTrigger>
            <TooltipPopup>New page</TooltipPopup>
          </Tooltip>
        ) : null}
      </div>
      <div className="px-3 pb-2">
        <InputGroup>
          <InputGroupInput
            aria-label="Search docs"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search docs"
            size="sm"
            type="search"
            value={query}
          />
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
        </InputGroup>
      </div>
      <ScrollArea className="flex-1" scrollFade>
        <nav aria-label="Document tree" className="px-2 pb-4">
          {searchResults ? (
            searchResults.length > 0 ? (
              <ul className="flex flex-col gap-px">
                {searchResults.map((document) => (
                  <li key={document.id}>
                    <TreeRow
                      active={document.id === actions.activeId}
                      depth={0}
                      href={`/app/p/${document.projectSlug}/docs/${document.id}`}
                      title={document.title}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <TreeEmpty
                description="Try a different word or phrase."
                title="No matching pages"
              />
            )
          ) : tree.length > 0 ? (
            <ul className="flex flex-col gap-px">
              {tree.map((node) => (
                <TreeNode
                  depth={0}
                  key={node.document.id}
                  node={node}
                  {...actions}
                />
              ))}
            </ul>
          ) : (
            <TreeEmpty
              description="Pages you create form a shared project index."
              title="No pages yet"
            />
          )}
        </nav>
      </ScrollArea>
    </aside>
  );
}

function TreeEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Empty className="px-2 py-8 md:py-8">
      <EmptyHeader>
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        <EmptyDescription className="text-xs">{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function TreeNode({
  node,
  depth,
  ...actions
}: TreeActions & { node: DocumentNode; depth: number }) {
  const { document, children } = node;
  const row = (
    <TreeRow
      actions={
        actions.canWrite ? <RowMenu id={document.id} {...actions} /> : null
      }
      active={document.id === actions.activeId}
      depth={depth}
      href={`/app/p/${actions.slug}/docs/${document.id}`}
      title={document.title}
      toggle={
        children.length > 0 ? (
          <CollapsibleTrigger
            aria-label={`Toggle ${document.title}`}
            className="[&[data-panel-open]>svg]:rotate-90"
            render={<Button size="icon-xs" variant="ghost" />}
          >
            <ChevronRightIcon
              aria-hidden="true"
              className="transition-transform duration-150"
            />
          </CollapsibleTrigger>
        ) : undefined
      }
    />
  );

  if (children.length === 0) return <li>{row}</li>;

  return (
    <li>
      <Collapsible defaultOpen>
        {row}
        <CollapsiblePanel>
          <ul className="flex flex-col gap-px pt-px">
            {children.map((child) => (
              <TreeNode
                depth={depth + 1}
                key={child.document.id}
                node={child}
                {...actions}
              />
            ))}
          </ul>
        </CollapsiblePanel>
      </Collapsible>
    </li>
  );
}

function TreeRow({
  href,
  title,
  depth,
  active,
  toggle,
  actions,
}: {
  href: string;
  title: string;
  depth: number;
  active: boolean;
  toggle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group/row text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 items-center gap-0.5 rounded-md pe-1 text-sm transition-colors sm:h-7",
        active && "bg-accent text-foreground font-medium",
      )}
      style={{ paddingInlineStart: `${4 + Math.min(depth, 5) * 12}px` }}
    >
      {toggle ?? (
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center sm:size-6"
        >
          <FileTextIcon className="size-3.5 opacity-64" />
        </span>
      )}
      <Link
        aria-current={active ? "page" : undefined}
        className="focus-visible:ring-ring min-w-0 flex-1 truncate rounded-sm py-1 outline-none focus-visible:ring-2"
        href={href}
      >
        {title}
      </Link>
      {actions}
    </div>
  );
}

function RowMenu({ id, onCreate, onMove }: TreeActions & { id: string }) {
  return (
    <Menu>
      <MenuTrigger
        aria-label="Page actions"
        className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
        render={<Button size="icon-xs" variant="ghost" />}
      >
        <EllipsisIcon aria-hidden="true" />
      </MenuTrigger>
      <MenuPopup align="start">
        <MenuItem onClick={() => onCreate(id)}>
          <FilePlus2Icon aria-hidden="true" />
          New child page
        </MenuItem>
        <MenuItem onClick={() => onMove(id)}>
          <FolderInputIcon aria-hidden="true" />
          Move page…
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
