"use client";

import { ArchiveIcon, ChevronDownIcon, FlagIcon, XIcon } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/ui/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
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
  onMilestone,
}: {
  columns: ColumnRow[];
  count: number;
  onArchive: () => void;
  onClear: () => void;
  onMove: (columnId: string) => void;
  onPriorityChange: (priority: Priority) => void;
  /** undefined = board has no open milestones */
  onMilestone?: () => void;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-4 left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2"
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
    >
      <Toolbar
        aria-label="Selected tasks"
        className="bg-popover overflow-x-auto shadow-lg/5"
      >
        <span className="shrink-0 px-2 text-sm font-medium tabular-nums">
          {count} selected
        </span>
        <ToolbarSeparator />
        <ToolbarGroup>
          <Menu>
            <MenuTrigger
              render={
                <ToolbarButton render={<Button size="sm" variant="ghost" />} />
              }
            >
              Move
              <ChevronDownIcon aria-hidden="true" />
            </MenuTrigger>
            <MenuPopup side="top">
              {columns.map((column) => (
                <MenuItem key={column.id} onClick={() => onMove(column.id)}>
                  {column.name}
                </MenuItem>
              ))}
            </MenuPopup>
          </Menu>
          <Menu>
            <MenuTrigger
              render={
                <ToolbarButton render={<Button size="sm" variant="ghost" />} />
              }
            >
              Priority
              <ChevronDownIcon aria-hidden="true" />
            </MenuTrigger>
            <MenuPopup side="top">
              {PRIORITIES.map((priority) => (
                <MenuItem
                  key={priority}
                  onClick={() => onPriorityChange(priority)}
                >
                  <PriorityIcon priority={priority} />
                  {PRIORITY_META[priority].label}
                </MenuItem>
              ))}
            </MenuPopup>
          </Menu>
          {onMilestone ? (
            <ToolbarButton
              onClick={onMilestone}
              render={<Button size="sm" variant="ghost" />}
            >
              <FlagIcon aria-hidden="true" />
              Milestone
            </ToolbarButton>
          ) : null}
          <ToolbarButton
            onClick={onArchive}
            render={<Button size="sm" variant="ghost" />}
          >
            <ArchiveIcon aria-hidden="true" />
            Archive
          </ToolbarButton>
        </ToolbarGroup>
        <ToolbarSeparator />
        <Tooltip>
          <TooltipTrigger
            render={
              <ToolbarButton
                aria-label="Clear selection"
                onClick={onClear}
                render={<Button size="icon-sm" variant="ghost" />}
              />
            }
          >
            <XIcon aria-hidden="true" />
          </TooltipTrigger>
          <TooltipPopup>
            Clear selection <Kbd>Esc</Kbd>
          </TooltipPopup>
        </Tooltip>
      </Toolbar>
    </motion.div>
  );
}
