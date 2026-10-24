"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

import { clamp, useScrollFrame } from "./scroll-frame";

type DriftProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Writes how far the block has crossed the screen as `--drift`: -1 as it comes
 * up from the bottom, 0 level with the middle, 1 as it leaves the top. Anything
 * inside can then move by its own share of that with `--depth`, which is what
 * makes one layer of a section travel a little faster than another.
 *
 * One block does the reading for everything inside it, so a section with a
 * dozen drawings in it still costs a single measurement per frame.
 */
export function Drift({ children, className }: DriftProps) {
  const blockRef = useRef<HTMLDivElement>(null);

  useScrollFrame(() => {
    const node = blockRef.current;

    if (!node) return;

    const { top, height } = node.getBoundingClientRect();
    const crossed = clamp((window.innerHeight - top) / (window.innerHeight + height));

    node.style.setProperty("--drift", `${crossed * 2 - 1}`);
  });

  return (
    <div ref={blockRef} className={className}>
      {children}
    </div>
  );
}
