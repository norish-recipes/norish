"use client";

import { useRef, useState } from "react";
import { links } from "@/lib/css-tokens";
import { CommandLineIcon } from "@heroicons/react/24/outline";

import { BrandLogo } from "./brand-logo";
import { GitHubIcon } from "./icons";
import { useScrollFrame } from "./scroll-frame";
import { ThemeToggle } from "./theme-toggle";

/** Enough movement to count as a direction rather than a wobble. */
const NUDGE = 6;

/** How far down the bar starts getting out of the way. */
const KEEP = 140;

/**
 * The same rounded bar the app and the docs wear: a surface pill floating just
 * off the top edge. It gets out of the way as you read down the page and comes
 * back the moment you scroll up.
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
      <div className="bg-surface mx-auto grid h-14 max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 rounded-full pr-2 pl-4 shadow-[0_8px_28px_-10px_rgb(0_0_0/0.3)] sm:h-16 sm:pr-3 sm:pl-5">
        <a aria-label="Norish home" className="justify-self-start" href="#top">
          <BrandLogo height={26} width={97} />
        </a>

        <nav aria-label="Main" className="hidden items-center gap-1 text-sm font-medium md:flex">
          <a
            className="text-muted hover:text-foreground hover:bg-default rounded-full px-4 py-2 transition-colors"
            href="#features"
          >
            Features
          </a>
          <a
            className="text-muted hover:text-foreground hover:bg-default rounded-full px-4 py-2 transition-colors"
            href={links.docs}
          >
            Docs
          </a>
        </nav>

        <div className="col-start-3 flex items-center gap-1 justify-self-end">
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
          <a
            className="bg-accent text-accent-foreground hover:bg-accent-deep ml-1 hidden h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors sm:inline-flex"
            href="#self-host"
          >
            <CommandLineIcon className="size-4.5" />
            Self-host
          </a>
        </div>
      </div>
    </header>
  );
}
