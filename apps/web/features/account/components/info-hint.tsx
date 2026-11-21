"use client";

import type { ReactNode } from "react";
import { QuestionMarkCircleIcon } from "@heroicons/react/16/solid";
import { Popover } from "@heroui/react";

/**
 * What a field means beyond its label, behind a question mark beside it: a
 * tap away on a phone, rather than a paragraph every reader scrolls past.
 */
export function InfoHint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover>
      <Popover.Trigger>
        <button
          aria-label={label}
          className="text-muted hover:text-foreground focus-visible:ring-focus inline-flex size-5 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
          type="button"
        >
          <QuestionMarkCircleIcon className="size-4" />
        </button>
      </Popover.Trigger>
      <Popover.Content className="max-w-xs" placement="top">
        <Popover.Arrow />
        <Popover.Dialog>
          <p className="text-muted px-1 py-2 text-sm">{children}</p>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
