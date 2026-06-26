"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { useTheme } from "next-themes";

/** Light/dark switch. Guards on `mounted` so the icon never mismatches on hydration. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  // Before mount, resolvedTheme is unknown — use a neutral label so the server
  // and first client render match (no hydration mismatch).
  const label = !mounted ? "Toggle theme" : isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      aria-label={label}
      className="border-border bg-surface-secondary text-foreground hover:bg-surface-tertiary focus-visible:ring-accent/50 focus-visible:ring-offset-background grid size-9 place-items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? (
        isDark ? (
          <SunIcon className="size-4.5" />
        ) : (
          <MoonIcon className="size-4.5" />
        )
      ) : (
        <span className="size-4.5" />
      )}
    </button>
  );
}
