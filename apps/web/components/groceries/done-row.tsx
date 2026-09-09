"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

interface DoneRowProps {
  /** How many rows are folded into it. */
  count: number;
  /** The done rows, exactly as they render: struck through, checkbox filled. */
  children: ReactNode;
}

/**
 * The folded tail of a section: one row at the bottom of the card that says
 * how many are done and opens on tap to show them. Closed on every load, so
 * a list finished last night is short this morning; the open state is not
 * remembered. A section with nothing done renders none of this.
 */
export function DoneRow({ count, children }: DoneRowProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("groceries.store");

  return (
    <div data-state={open ? "open" : "closed"} data-testid="done-heading">
      <button
        aria-expanded={open}
        className="text-muted hover:text-foreground flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors"
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span className="flex-1">{t("done", { count })}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          className="shrink-0"
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon className="h-4 w-4" />
        </motion.span>
      </button>
      {open && <div className="border-border divide-border divide-y border-t">{children}</div>}
    </div>
  );
}
