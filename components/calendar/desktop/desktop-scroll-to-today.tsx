"use client";

import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";

type DesktopScrollToTodayProps = {
  isVisible: boolean;
  direction: "up" | "down";
  onClick: () => void;
};

export function DesktopScrollToToday({ isVisible, direction, onClick }: DesktopScrollToTodayProps) {
  const t = useTranslations("calendar.mobile");

  const Icon = direction === "up" ? ChevronUpIcon : ChevronDownIcon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          animate={{ opacity: 1 }}
          className="pointer-events-none fixed inset-x-0 z-50 mx-auto w-full max-w-7xl px-4"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex justify-end">
            <Button
              isIconOnly
              aria-label={t("scrollToToday")}
              className="bg-primary text-primary-foreground pointer-events-auto h-10 w-10 rounded-full shadow-lg transition-transform active:scale-95"
              onPress={onClick}
            >
              <Icon className="h-5 w-5" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
