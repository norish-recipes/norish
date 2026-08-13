"use client";

import React, { useState } from "react";
import { FiltersPanel } from "@/components/Panel/consumers";
import { useRecipesContext } from "@/context/recipes-context";
import { useAutoHide } from "@/hooks/auto-hide";
import { Button } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

export default function FloatingRecipeChip() {
  const { total, isLoading } = useRecipesContext();
  const [isOpen, setIsOpen] = useState(false);
  const isVisibleByCount = !isLoading && total > 0;
  const t = useTranslations("recipes.dashboard");
  const { isVisible } = useAutoHide();
  if (!isVisibleByCount) return null;
  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            key="chip"
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="pointer-events-none fixed inset-x-0 bottom-8 z-50 hidden justify-center md:flex"
            exit={{
              opacity: 0,
              y: 24,
            }}
            initial={{
              opacity: 0,
              y: 24,
            }}
            transition={{
              duration: 0.25,
            }}
          >
            <div className="pointer-events-auto">
              <Button
                className="bg-chrome text-chrome-foreground border-chrome-border hover:bg-chrome-hover data-[hovered=true]:bg-chrome-hover h-8 min-w-16 rounded-full border px-4 py-0 shadow-md transition-colors"
                size="sm"
                onPress={() => setIsOpen(true)}
                variant="tertiary"
              >
                <span className="text-sm">
                  {t("recipeCount", {
                    count: total,
                  })}
                </span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/*
       * Deliberately outside the auto-hide. The panel subscribes to queries, and
       * the pill unmounts every time you scroll down and mounts again when you
       * scroll back up — which refetched the panel's whole query set on each
       * reveal. The panel's own visibility is `open`, not the pill's.
       */}
      <FiltersPanel open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
