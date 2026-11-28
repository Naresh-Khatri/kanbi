"use client";

import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  ChevronRightIcon,
  CopyIcon,
  EllipsisIcon,
  FilePlus2Icon,
  FileTextIcon,
  FolderInputIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  StarOffIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

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
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { positionBetween, POSITION_STEP } from "@/lib/position";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@/trpc/react";
import {
  buildTree,
  descendantIds,
  type DocumentList,
  type DocumentNode,
} from "./tree";
import type { DocActions } from "./use-doc-actions";

type TreeActions = {
  slug: string;
  activeId?: string;
  canWrite: boolean;
  onCreate: (parentId: string | null) => void;
  onMove: (documentId: string) => void;
  actions: DocActions;
};

type Zone = "before" | "inside" | "after";
type DropTarget = { id: string; zone: Zone } | null;

const DropContext = createContext<{ target: DropTarget; dragging: string | null }>(
  { target: null, dragging: null },
);

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
  const favorites = useMemo(
    () =>
      documents
        .filter((doc) => doc.favoritedAt)
        .sort(
          (a, b) =>
            new Date(a.favoritedAt!).getTime() -
            new Date(b.favoritedAt!).getTime(),
        ),
    [documents],
  );
  const dnd = useTreeDnd(documents, actions.actions);

  return (
    <aside className="bg-sidebar flex max-h-48 w-full shrink-0 flex-col border-b md:max-h-none md:w-64 md:border-e md:border-b-0">
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
            <>
              {favorites.length > 0 ? (
                <section aria-label="Favorites" className="mb-3">
                  <h3 className="text-muted-foreground px-2 pt-1 pb-1 text-xs font-medium">
                    Favorites
                  </h3>
                  <ul className="flex flex-col gap-px">
                    {favorites.map((document) => (
                      <li key={document.id}>
                        <TreeRow
                          active={document.id === actions.activeId}
                          depth={0}
                          href={`/app/p/${actions.slug}/docs/${document.id}`}
                          icon={document.icon}
                          menu={<RowMenu document={document} {...actions} />}
                          title={document.title}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <DndContext
                onDragCancel={dnd.reset}
                onDragEnd={dnd.onDragEnd}
                onDragMove={dnd.onDragMove}
                onDragStart={(e) => dnd.setDragging(String(e.active.id))}
                sensors={dnd.sensors}
              >
                <DropContext.Provider
                  value={{ target: dnd.target, dragging: dnd.dragging }}
                >
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
                </DropContext.Provider>
                <DragOverlay dropAnimation={null}>
                  {dnd.dragging ? (
                    <div className="bg-popover text-foreground flex h-7 w-52 items-center gap-1.5 rounded-md border px-2 text-sm shadow-md">
                      <PageIcon
                        icon={
                          documents.find((d) => d.id === dnd.dragging)?.icon
                        }
                      />
                      <span className="truncate">
                        {documents.find((d) => d.id === dnd.dragging)?.title}
                      </span>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </>
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

function useTreeDnd(documents: DocumentList, actions: DocActions) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // press-and-hold so touch scrolling still works
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );
  const reset = () => {
    setDragging(null);
    setTarget(null);
  };

  const onDragMove = (e: DragMoveEvent) => {
    const { over, active, activatorEvent, delta } = e;
    if (!over || over.id === active.id) return setTarget(null);
    const blocked = descendantIds(documents, String(active.id));
    if (blocked.has(String(over.id))) return setTarget(null);
    const start =
      "clientY" in activatorEvent
        ? (activatorEvent as MouseEvent).clientY
        : ((activatorEvent as TouchEvent).touches[0]?.clientY ?? 0);
    const y = start + delta.y;
    const ratio = (y - over.rect.top) / over.rect.height;
    const zone: Zone =
      ratio < 0.28 ? "before" : ratio > 0.72 ? "after" : "inside";
    setTarget((prev) =>
      prev?.id === over.id && prev.zone === zone
        ? prev
        : { id: String(over.id), zone },
    );
  };

  const onDragEnd = (e: DragEndEvent) => {
    const drop = target;
    const id = String(e.active.id);
    reset();
    if (!drop) return;
    const over = documents.find((d) => d.id === drop.id);
    if (!over) return;

    if (drop.zone === "inside") {
      const kids = documents.filter(
        (d) => d.parentId === over.id && d.id !== id,
      );
      const last = Math.max(0, ...kids.map((d) => d.position));
      actions.move({
        documentId: id,
        parentId: over.id,
        position: last + POSITION_STEP,
      });
      return;
    }
    const siblings = documents
      .filter((d) => d.parentId === over.parentId && d.id !== id)
      .sort((a, b) => a.position - b.position);
    const index = siblings.findIndex((d) => d.id === over.id);
    const prev = drop.zone === "before" ? siblings[index - 1] : over;
    const next = drop.zone === "before" ? over : siblings[index + 1];
    actions.move({
      documentId: id,
      parentId: over.parentId,
      beforeId: prev?.id ?? null,
      afterId: next?.id ?? null,
      position: positionBetween(prev?.position, next?.position),
    });
  };

  return { sensors, dragging, setDragging, target, reset, onDragMove, onDragEnd };
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
  const { target, dragging } = useContext(DropContext);
  const drag = useDraggable({ id: document.id, disabled: !actions.canWrite });
  const drop = useDroppable({ id: document.id, disabled: !actions.canWrite });
  const zone = target?.id === document.id ? target.zone : null;

  const row = (
    <div
      className={cn(
        "relative rounded-md",
        dragging === document.id && "opacity-40",
        zone === "inside" && "ring-primary bg-primary/8 ring-1",
      )}
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      {...drag.attributes}
      {...drag.listeners}
      // links handle keyboard focus; dnd-kit's role/tabIndex would double it
      role={undefined}
      tabIndex={undefined}
    >
      {zone === "before" || zone === "after" ? (
        <span
          aria-hidden="true"
          className={cn(
            "bg-primary pointer-events-none absolute inset-x-1 h-0.5 rounded-full",
            zone === "before" ? "-top-px" : "-bottom-px",
          )}
          style={{ insetInlineStart: `${4 + Math.min(depth, 5) * 12}px` }}
        />
      ) : null}
      <TreeRow
        active={document.id === actions.activeId}
        depth={depth}
        href={`/app/p/${actions.slug}/docs/${document.id}`}
        icon={document.icon}
        menu={<RowMenu document={document} {...actions} />}
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
    </div>
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

export function PageIcon({
  icon,
  className,
}: {
  icon?: string | null;
  className?: string;
}) {
  return icon ? (
    <span aria-hidden="true" className={cn("text-[0.95em] leading-none", className)}>
      {icon}
    </span>
  ) : (
    <FileTextIcon
      aria-hidden="true"
      className={cn("size-3.5 opacity-64", className)}
    />
  );
}

function TreeRow({
  href,
  title,
  icon,
  depth,
  active,
  toggle,
  menu,
}: {
  href: string;
  title: string;
  icon?: string | null;
  depth: number;
  active: boolean;
  toggle?: ReactNode;
  menu?: ReactNode;
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
          <PageIcon icon={icon} />
        </span>
      )}
      <Link
        aria-current={active ? "page" : undefined}
        className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-1.5 rounded-sm py-1 outline-none focus-visible:ring-2"
        draggable={false}
        href={href}
      >
        {/* toggle took the glyph slot, so the emoji moves next to the title */}
        {toggle && icon ? <PageIcon icon={icon} /> : null}
        <span className="truncate">{title}</span>
      </Link>
      {menu}
    </div>
  );
}

function RowMenu({
  document,
  canWrite,
  onCreate,
  onMove,
  actions,
}: TreeActions & { document: DocumentList[number] }) {
  return (
    <Menu>
      <MenuTrigger
        aria-label="Page actions"
        className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
        // don't start a drag from the menu button
        onPointerDown={(e) => e.stopPropagation()}
        render={<Button size="icon-xs" variant="ghost" />}
      >
        <EllipsisIcon aria-hidden="true" />
      </MenuTrigger>
      <MenuPopup align="start">
        <MenuItem onClick={() => actions.toggleFavorite(document.id)}>
          {document.favoritedAt ? (
            <StarOffIcon aria-hidden="true" />
          ) : (
            <StarIcon aria-hidden="true" />
          )}
          {document.favoritedAt ? "Remove from favorites" : "Add to favorites"}
        </MenuItem>
        {canWrite ? (
          <>
            <MenuItem onClick={() => onCreate(document.id)}>
              <FilePlus2Icon aria-hidden="true" />
              New child page
            </MenuItem>
            <MenuItem onClick={() => actions.duplicate(document.id)}>
              <CopyIcon aria-hidden="true" />
              Duplicate
            </MenuItem>
            <MenuItem onClick={() => onMove(document.id)}>
              <FolderInputIcon aria-hidden="true" />
              Move page…
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              onClick={() => actions.remove(document.id)}
              variant="destructive"
            >
              <Trash2Icon aria-hidden="true" />
              Delete
            </MenuItem>
          </>
        ) : null}
      </MenuPopup>
    </Menu>
  );
}
