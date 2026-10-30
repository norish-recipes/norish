"use client";

import type { ComponentProps, ReactNode } from "react";
import { ViewTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { arrivesBack, arriveWhereLeft } from "@/lib/scroll-memory";

import { APP_PAGE_COLUMN_CLASS } from "@norish/web/config/css-tokens";

/**
 * The template of `(app)` and of `recipes`, so every navigation remounts one and slides it. The div
 * gives the browser one box per page to capture, whatever the page renders.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  // The link records the direction (lib/scroll-memory.ts), not transitionTypes: React queues types
  // on the root, and a transition or Suspense retry that commits before the navigation claims them.
  const slide = arrivesBack(usePathname()) ? "nav-back" : "nav-forward";

  return (
    <ViewTransition default="none" enter={slide} exit={slide}>
      <div className={APP_PAGE_COLUMN_CLASS}>{children}</div>
    </ViewTransition>
  );
}

/**
 * A link to where the reader came from: it slides in from the left and returns the page to where
 * it was scrolled, instead of Next's scroll to the top.
 */
export function BackLink({
  href,
  onNavigate,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  return (
    <Link
      {...props}
      href={href}
      scroll={false}
      onNavigate={(event) => {
        onNavigate?.(event);
        arriveWhereLeft(href);
      }}
    />
  );
}
