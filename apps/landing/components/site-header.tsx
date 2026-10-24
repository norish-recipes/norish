"use client";

import { useRef, useState } from "react";
import { links } from "@/lib/css-tokens";
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";

import { Action } from "./action";
import { BrandLogo } from "./brand-logo";
import { GitHubIcon } from "./icons";
import { useScrollFrame } from "./scroll-frame";
import { ThemeToggle } from "./theme-toggle";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Getting started", href: "#self-host" },
];

/** Enough movement to count as a direction rather than a wobble. */
const NUDGE = 6;

/** How far down the bar starts getting out of the way. */
const KEEP = 140;

/**
 * The same rounded bar the app itself wears: a surface pill floating just off
 * the top edge, with the app's shadow. It gets out of the way as you read down
 * the page and comes back the moment you scroll up, so a long section has the
 * whole screen and the way out is never more than a flick away.
 */
export function SiteHeader() {
  const [hidden, setHidden] = useState(false);
  const lastRef = useRef(0);

  useScrollFrame(() => {
    const y = window.scrollY;
    const moved = y - lastRef.current;

    if (Math.abs(moved) < NUDGE) return;

    lastRef.current = y;
    setHidden(moved > 0 && y > KEEP);
  });

  return (
    <header
      className="site-header fixed inset-x-0 top-3 z-50 px-3 sm:top-4 sm:px-6"
      data-hidden={hidden}
    >
      <div className="bg-surface mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 rounded-full px-4 shadow-[0_8px_28px_-10px_rgb(0_0_0/0.3)] sm:h-16 sm:px-5">
        <a aria-label="Norish home" className="shrink-0" href="#top">
          <BrandLogo height={26} width={97} />
        </a>

        <nav className="hidden items-center gap-7 text-sm md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              className="text-muted hover:text-foreground transition-colors"
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <a
            aria-label="Norish on GitHub"
            className="text-muted hover:text-foreground hover:bg-default grid size-9 place-items-center rounded-full transition-colors"
            href={links.github}
            rel="noreferrer"
            target="_blank"
          >
            <GitHubIcon className="size-4.5" />
          </a>
          <ThemeToggle />
          <Action external small className="ml-2 hidden sm:inline-flex" href={links.docs}>
            Docs
            <ArrowUpRightIcon className="size-3.5" />
          </Action>
        </div>
      </div>
    </header>
  );
}
