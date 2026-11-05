"use client";

import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ColumnPicker({
  columns,
  value,
  onChange,
  className,
}: {
  columns: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
}) {
  const current = columns.find((c) => c.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn("gap-1 px-1.5 text-sm font-medium", className)}
          size="xs"
          type="button"
          variant="property"
        >
          {current?.name ?? "column"}
          <ChevronDown className="h-3 w-3 text-white/40" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {columns.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => onChange(c.id)}>
            {c.name}
            {c.id === value ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
