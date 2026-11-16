"use client";

import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyButton } from "./copy-button";

/** read-only url + copy + remove, shared by share links and invite links. */
export function LinkField({
  url,
  label,
  removeLabel,
  removing,
  onRemove,
}: {
  url: string;
  label: string;
  removeLabel: string;
  removing: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <InputGroup>
        <InputGroupInput
          aria-label={label}
          className="font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
          readOnly
          size="sm"
          value={url}
        />
        <InputGroupAddon align="inline-end">
          <CopyButton value={url} />
        </InputGroupAddon>
      </InputGroup>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={removeLabel}
              disabled={removing}
              onClick={onRemove}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <Trash2Icon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipPopup>{removeLabel}</TooltipPopup>
      </Tooltip>
    </div>
  );
}
