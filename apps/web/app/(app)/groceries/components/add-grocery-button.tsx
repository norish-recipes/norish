"use client";

import { Button } from "@heroui/react";
import { PlusIcon } from "@heroicons/react/16/solid";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import { useGroceriesUIContext } from "../context";

import { useAutoHide } from "@/hooks/auto-hide";

/**
 * Mobile floating add button that repositions based on nav visibility.
 * - Nav visible: sits just above the nav bar
 * - Nav hidden: moves down to bottom of screen (flush with safe area)
 * Uses context state so both desktop header button and this mobile FAB control the same panel.
 * The panel itself is rendered in groceries-page.tsx (single instance).
 */
export default function AddGroceryButton() {
  const { addGroceryPanelOpen, setAddGroceryPanelOpen } = useGroceriesUIContext();
  const { isVisible, show } = useAutoHide({ disabled: addGroceryPanelOpen });
  const t = useTranslations("groceries.page");

  // When nav is visible: position above it (nav height ~3.25rem + gap)
  // When nav is hidden: position at bottom safe area
  const bottomWhenNavVisible = "calc(max(env(safe-area-inset-bottom), 1rem) + 4.5rem)";
  const bottomWhenNavHidden = "calc(max(env(safe-area-inset-bottom), 1rem) + 0.5rem)";

  return (
    <motion.div
      animate={{
        bottom: isVisible ? bottomWhenNavVisible : bottomWhenNavHidden,
      }}
      className="pointer-events-none fixed left-1/2 -translate-x-1/2 will-change-transform md:hidden"
      initial={false}
      style={{
        bottom: bottomWhenNavVisible,
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <motion.div
        className="pointer-events-auto"
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          className="font-medium shadow-lg"
          color="primary"
          radius="full"
          size="lg"
          startContent={<PlusIcon className="h-5 w-5" />}
          onPress={() => {
            setAddGroceryPanelOpen(true);
            show();
          }}
        >
          {t("addItems")}
        </Button>
      </motion.div>
    </motion.div>
  );
}
