"use client";

import { useState } from "react";

/** What the open panel is for: a new entry, or an existing one. */
export type ContentTarget = { kind: "add" } | { kind: "entry"; id: string };

/**
 * Which panel of a list is open. Each opening has a new `nonce`, so a panel never keeps the draft
 * of the last one.
 */
export function useContentTarget() {
  const [shown, setShown] = useState<{ target: ContentTarget; nonce: number } | null>(null);
  const [open, setOpen] = useState(false);
  const show = (target: ContentTarget) => {
    setShown({ target, nonce: (shown?.nonce ?? 0) + 1 });
    setOpen(true);
  };

  return {
    target: shown?.target ?? null,
    nonce: shown?.nonce ?? 0,
    open,
    setOpen,
    openAdd: () => show({ kind: "add" }),
    openEntry: (id: string) => show({ kind: "entry", id }),
  };
}
