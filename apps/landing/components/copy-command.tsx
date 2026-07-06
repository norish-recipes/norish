"use client";

import { useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
} from "@heroicons/react/24/outline";

type CopyCommandProps = {
  /** The literal text copied to the clipboard. */
  code: string;
  /** Optional richer JSX to render instead of the raw code (e.g. highlighted). */
  children?: React.ReactNode;
  filename?: string;
  /** When true, the body collapses to a fixed height with an expand toggle. */
  collapsible?: boolean;
};

/** A terminal/editor-style code card with a copy button. */
export function CopyCommand({
  code,
  children,
  filename = "docker-compose.yml",
  collapsible = false,
}: CopyCommandProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — fail silently.
    }
  };

  const collapsed = collapsible && !expanded;

  return (
    <div className="border-border bg-surface overflow-hidden rounded-2xl border text-left shadow-[0_30px_60px_-32px_rgba(0,0,0,0.5)]">
      <div className="border-border bg-surface-secondary/50 flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="text-muted ml-2 font-mono text-xs">{filename}</span>
        </div>
        <button
          className="text-muted hover:text-foreground hover:bg-surface inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors"
          type="button"
          onClick={copy}
        >
          {copied ? (
            <>
              <CheckIcon className="text-accent size-3.5" /> Copied
            </>
          ) : (
            <>
              <ClipboardIcon className="size-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <div className="relative">
        <pre
          className={`scrollbar-hide overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-relaxed ${
            collapsed ? "max-h-72 overflow-y-hidden" : ""
          }`}
        >
          <code>{children ?? code}</code>
        </pre>
        {collapsed ? (
          <div className="from-surface pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t to-transparent" />
        ) : null}
      </div>
      {collapsible ? (
        <button
          className="border-border text-muted hover:text-foreground hover:bg-surface-secondary/50 flex w-full items-center justify-center gap-1.5 border-t py-2 text-xs transition-colors"
          type="button"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              Show less <ChevronUpIcon className="size-3.5" />
            </>
          ) : (
            <>
              Show full file <ChevronDownIcon className="size-3.5" />
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}
