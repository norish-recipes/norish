"use client";

import { useDockedTimers } from "@/hooks/use-docked-timers";
import { useFloatingDock } from "@/hooks/use-floating-dock";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import { cssFloatingDockEndCap } from "@norish/web/config/css-tokens";

type TimelineScrollToTodayProps = {
  isVisible: boolean;
  direction: "up" | "down";
  onClick: () => void;
};

/**
 * The way back to today, stacked on the end of the nav pill: the same disc as
 * the user-menu circle directly below it, on the same centre line, so the two
 * read as one column rather than as a button that happens to be near the bar.
 *
 * It takes the nav's own shrink about the nav's own anchor rather than holding
 * still while the bar moves under it, because a bar that hides by shrinking in
 * place never vacates the corner a fixed button would be left stranded over.
 */
export function TimelineScrollToToday({
  isVisible,
  direction,
  onClick,
}: TimelineScrollToTodayProps) {
  const t = useTranslations("calendar.mobile");
  const hasDockedTimers = useDockedTimers().length > 0;
  // The dock holds the right end of the row it floats in, and a timer running
  // is worth more of that corner than a scroll shortcut is.
  const floatingDock = useFloatingDock({
    align: hasDockedTimers ? "start" : "end",
    station: "stacked",
  });
  const Icon = direction === "up" ? ChevronUpIcon : ChevronDownIcon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          animate={{
            opacity: 1,
            scale: 1,
            ...floatingDock.animate,
          }}
          className={`${floatingDock.className} z-50`}
          exit={{
            opacity: 0,
            scale: 0.8,
          }}
          initial={{
            opacity: 0,
            scale: 0.8,
          }}
          style={floatingDock.style}
          transition={floatingDock.transition}
        >
          <Button
            isIconOnly
            aria-label={t("scrollToToday")}
            className={`bg-accent text-accent-foreground shadow-lg transition-transform active:scale-95 ${floatingDock.pillClassName} ${cssFloatingDockEndCap}`}
            onPress={onClick}
          >
            <Icon className="h-5 w-5" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
