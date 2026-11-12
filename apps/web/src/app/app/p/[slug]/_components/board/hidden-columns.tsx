"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@/components/ui/menu";
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
    <Menu>
      <MenuTrigger
        render={
          <Button
            className="text-muted-foreground shrink-0"
            size="sm"
            variant="ghost"
          />
        }
      >
        <EyeOffIcon aria-hidden="true" />
        Hidden
        <Badge size="sm" variant="secondary">
          {columns.length}
        </Badge>
      </MenuTrigger>
      <MenuPopup align="end">
        <MenuGroup>
          <MenuGroupLabel>Show column</MenuGroupLabel>
          {columns.map((column) => (
            <MenuItem key={column.id} onClick={() => onShow(column.id)}>
              <EyeIcon aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{column.name}</span>
            </MenuItem>
          ))}
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}
