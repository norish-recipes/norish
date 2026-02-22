"use client";

import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";

type TimelineScrollToTodayProps = {
  isVisible: boolean;
  direction: "up" | "down";
  onClick: () => void;
};

export function TimelineScrollToToday({
  isVisible,
  direction,
  onClick,
}: TimelineScrollToTodayProps) {
  const t = useTranslations("calendar.mobile");

  const Icon = direction === "up" ? ChevronUpIcon : ChevronDownIcon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="fixed z-50"
          exit={{ opacity: 0, scale: 0.8 }}
          initial={{ opacity: 0, scale: 0.8 }}
          style={{
            right: "calc(20px + 6px)",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)",
          }}
          transition={{ duration: 0.15 }}
        >
          <Button
            isIconOnly
            aria-label={t("scrollToToday")}
            className="bg-primary text-primary-foreground h-10 w-10 rounded-full shadow-lg transition-transform active:scale-95"
            onPress={onClick}
          >
            <Icon className="h-5 w-5" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
