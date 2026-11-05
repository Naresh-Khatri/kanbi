"use client";

import { Archive, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Priority } from "../priority";
import { PRIORITIES, PRIORITY_META, PriorityIcon } from "../priority";
import type { ColumnRow } from "./board-types";

export function BulkTaskActions({
  columns,
  count,
  onArchive,
  onClear,
  onMove,
  onPriorityChange,
}: {
  columns: ColumnRow[];
  count: number;
  onArchive: () => void;
  onClear: () => void;
  onMove: (columnId: string) => void;
  onPriorityChange: (priority: Priority) => void;
}) {
  return (
    <div className="bg-raised absolute bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-lg border border-white/20 p-1.5">
      <span className="shrink-0 px-2 text-sm font-medium">
        {count} selected
      </span>
      <div className="mx-1 h-5 w-px bg-white/10" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="gap-1.5" size="sm" variant="ghost">
            Move
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {columns.map((column) => (
            <DropdownMenuItem
              key={column.id}
              onSelect={() => onMove(column.id)}
            >
              {column.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="gap-1.5" size="sm" variant="ghost">
            Priority
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {PRIORITIES.map((priority) => (
            <DropdownMenuItem
              key={priority}
              onSelect={() => onPriorityChange(priority)}
            >
              <PriorityIcon className="h-3.5 w-3.5" priority={priority} />
              {PRIORITY_META[priority].label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button className="gap-1.5" onClick={onArchive} size="sm" variant="ghost">
        <Archive className="h-3.5 w-3.5" />
        Archive
      </Button>
      <Button
        aria-label="Clear task selection"
        onClick={onClear}
        size="icon"
        title="Clear selection (Esc)"
        variant="ghost"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
