"use client";

import { useEffect, useState } from "react";


import { BrandLogo } from "./brand-logo";
import { CTAButton } from "./cta-button";
import { GitHubIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

import { links } from "@/lib/css-tokens";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Showcase", href: "#showcase" },
  { label: "How it works", href: "#how" },
  { label: "Get started", href: "#self-host" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3 sm:pt-4">
      <nav
        className={`flex w-full max-w-5xl items-center justify-between gap-3 rounded-full border px-3 py-2 transition-all duration-300 sm:px-4 ${
          scrolled
            ? "border-border bg-surface/90 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.45)] backdrop-blur-xl"
            : "border-border/70 bg-surface/70 shadow-[0_6px_24px_-22px_rgba(0,0,0,0.4)] backdrop-blur-md"
        }`}
      >
        <a aria-label="Norish home" className="flex items-center gap-2 pl-1" href="#top">
          <BrandLogo priority height={28} width={104} />
        </a>

        <div className="text-muted hidden items-center gap-1 text-sm md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              className="hover:text-foreground hover:bg-surface-secondary rounded-full px-3 py-1.5 transition-colors"
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            aria-label="Norish on GitHub"
            className="border-border bg-surface-secondary text-foreground hover:bg-surface-tertiary hidden size-9 place-items-center rounded-full border transition-colors sm:grid"
            href={links.github}
            rel="noreferrer"
            target="_blank"
          >
            <GitHubIcon className="size-4.5" />
          </a>
          <ThemeToggle />
          <CTAButton className="hidden sm:inline-flex" href="#self-host" size="md">
            Get started
          </CTAButton>
        </div>
      </nav>
    </header>
  );
}
