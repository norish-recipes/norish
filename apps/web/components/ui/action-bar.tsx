"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useEffect } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useAppStore } from "@/stores/useAppStore";
import { Separator, Toolbar } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { twMerge } from "tailwind-merge";

/**
 * A floating bar of actions on whatever is selected, in the place of the
 * mobile nav and the Library pill while it is open. A count goes in Prefix,
 * the actions in Content and the way out in Suffix.
 */
function ActionBarRoot({
  isOpen,
  "aria-label": ariaLabel,
  children,
  className,
}: {
  isOpen: boolean;
  "aria-label": string;
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const setActionBarOpen = useAppStore((state) => state.setActionBarOpen);

  useEffect(() => {
    if (!isOpen) return;
    setActionBarOpen(true);

    return () => setActionBarOpen(false);
  }, [isOpen, setActionBarOpen]);

  const offset = reduceMotion ? 0 : 24;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="action-bar"
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 md:bottom-8"
          exit={{ opacity: 0, y: offset }}
          initial={{ opacity: 0, y: offset }}
          // The mobile nav's own inset, so the bar lands where the nav stood.
          style={{ bottom: "max(calc(env(safe-area-inset-bottom) - 0.2rem), 1rem)" }}
          transition={{ duration: 0.2 }}
        >
          <Toolbar
            aria-label={ariaLabel}
            className={twMerge(
              "bg-chrome border-chrome-border text-chrome-foreground pointer-events-auto flex h-12 max-w-full items-center gap-1 rounded-full border px-2 shadow-[0_8px_28px_-10px_rgba(0,0,0,0.3)]",
              className
            )}
          >
            {children}
          </Toolbar>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={twMerge("flex items-center gap-1", className)} {...props} />;
}

function Divider() {
  return <Separator className="bg-chrome-border mx-1 h-6" orientation="vertical" />;
}

function Prefix(props: ComponentPropsWithoutRef<"div">) {
  return <Section {...props} className={twMerge("px-2 text-sm font-medium", props.className)} />;
}

function Content(props: ComponentPropsWithoutRef<"div">) {
  return (
    <>
      <Divider />
      <Section {...props} />
    </>
  );
}

function Suffix(props: ComponentPropsWithoutRef<"div">) {
  return (
    <>
      <Divider />
      <Section {...props} />
    </>
  );
}

/** A button label that folds to its icon below the small breakpoint, still read aloud. */
function Label({ children }: { children: ReactNode }) {
  return <span className="max-sm:sr-only">{children}</span>;
}

/** The chrome-surface look for a button in the bar. */
export const actionBarButtonClassName =
  "text-chrome-foreground hover:bg-chrome-hover data-[hovered=true]:bg-chrome-hover rounded-full bg-transparent";

export const ActionBar = Object.assign(ActionBarRoot, { Prefix, Content, Suffix, Label });
