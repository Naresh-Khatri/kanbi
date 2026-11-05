"use client";

import { Eye, EyeOff } from "lucide-react";
import { CountBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnRow } from "./board-types";

export function HiddenColumns({
  columns,
  onShow,
}: {
  columns: ColumnRow[];
  onShow: (columnId: string) => void;
}) {
  if (columns.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-10 shrink-0 gap-2" variant="outline">
          <EyeOff className="h-4 w-4" />
          Hidden columns
          <CountBadge>{columns.length}</CountBadge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {columns.map((column) => (
          <DropdownMenuItem key={column.id} onSelect={() => onShow(column.id)}>
            <Eye className="h-3.5 w-3.5" />
            <span className="min-w-0 flex-1 truncate">{column.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
