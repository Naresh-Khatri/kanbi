"use client";

import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/components/ui/menu";
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
    <Menu>
      <MenuTrigger
        render={
          <Button
            className={cn("gap-1 px-1.5 font-medium", className)}
            size="xs"
            type="button"
            variant="ghost"
          />
        }
      >
        {current?.name ?? "Column"}
        <ChevronDownIcon aria-hidden="true" className="text-muted-foreground" />
      </MenuTrigger>
      <MenuPopup align="start">
        <MenuRadioGroup
          onValueChange={(v) => onChange(v as string)}
          value={value ?? ""}
        >
          {columns.map((c) => (
            <MenuRadioItem key={c.id} value={c.id}>
              {c.name}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}
