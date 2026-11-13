"use client";

import { useDockedTimers } from "@/hooks/use-docked-timers";
import { useFloatingDock } from "@/hooks/use-floating-dock";
import { PlusIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import { useGroceriesUiStore } from "@norish/shared-react/groceries";
import { cssFloatingDockPill } from "@norish/web/config/css-tokens";

/**
 * The phone's way into the add panel: the same pill the cook button and the
 * timer dock are, floating above the nav on the same offsets, so the three
 * cannot drift apart. It keeps its station over the nav and takes the nav's
 * own shrink rather than dropping to the floor, because a bar that hides by
 * shrinking in place never vacates the corner an escaping button would land in.
 *
 * Centred over the middle of the bar while it has the row to itself, and out
 * of the way at the left end once a timer is running — the dock owns the right
 * end, and two pills meeting in the middle is one pill covering the other. The
 * desktop header has its own add button, so this is mobile only.
 */
export default function AddGroceryButton() {
  const addGroceryPanelOpen = useGroceriesUiStore((state) => state.addGroceryPanelOpen);
  const setAddGroceryPanelOpen = useGroceriesUiStore((state) => state.setAddGroceryPanelOpen);
  const hasDockedTimers = useDockedTimers().length > 0;
  // Held at full size while the panel is open, so the control the reader just
  // pressed does not shrink out from under the panel it opened.
  const floatingDock = useFloatingDock({
    align: hasDockedTimers ? "start" : "center",
    disabled: addGroceryPanelOpen,
  });
  const t = useTranslations("groceries.page");

  return (
    <motion.div
      animate={floatingDock.animate}
      className={`${floatingDock.className} z-50 md:hidden`}
      initial={false}
      style={floatingDock.style}
      transition={floatingDock.transition}
    >
      <Button
        className={`shadow-xl ${floatingDock.pillClassName} ${cssFloatingDockPill}`}
        variant="primary"
        onPress={() => setAddGroceryPanelOpen(true)}
      >
        <PlusIcon className="size-5" />
        {t("addItems")}
      </Button>
    </motion.div>
  );
}
