"use client";

import { useRef, useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";

/** Feature-detected: present in browsers that ship the View Transition API. */
type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

const noSubscription = () => () => {};

/**
 * Light/dark switch. Where the View Transition API exists, the new theme
 * sweeps out from this button as a growing circle (see `theme-reveal` in
 * globals.css); everywhere else, and under reduced motion, it just switches.
 * Guards on `mounted` so the icon never mismatches on hydration.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // False on the server and while hydrating, true once in the browser.
  const mounted = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false
  );
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isDark = resolvedTheme === "dark";
  // Before mount, resolvedTheme is unknown — use a neutral label so the server
  // and first client render match (no hydration mismatch).
  const label = !mounted ? "Toggle theme" : isDark ? "Switch to light mode" : "Switch to dark mode";

  const toggle = () => {
    const next = isDark ? "light" : "dark";
    const doc = document as DocumentWithViewTransition;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!doc.startViewTransition || reduced || !buttonRef.current) {
      setTheme(next);

      return;
    }

    // The circle grows from the button itself, reaching the farthest corner.
    const { left, top, width, height } = buttonRef.current.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const root = document.documentElement.style;

    root.setProperty("--theme-reveal-x", `${x}px`);
    root.setProperty("--theme-reveal-y", `${y}px`);
    root.setProperty("--theme-reveal-r", `${radius}px`);

    doc.startViewTransition(() => {
      // The snapshot pair needs the DOM flipped synchronously inside the callback.
      // eslint-disable-next-line @eslint-react/dom-no-flush-sync
      flushSync(() => setTheme(next));
    });
  };

  return (
    <button
      ref={buttonRef}
      aria-label={label}
      className="text-muted hover:text-foreground hover:bg-default grid size-9 place-items-center rounded-full transition-colors"
      type="button"
      onClick={toggle}
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
