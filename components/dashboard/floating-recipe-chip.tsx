"use client";

import React, { useState } from "react";
import { Button } from "@heroui/react";
import { motion, AnimatePresence } from "motion/react";

import { FiltersPanel } from "@/components/Panel/consumers";
import { useRecipesContext } from "@/context/recipes-context";
import { useAutoHide } from "@/hooks/auto-hide";

export default function FloatingRecipeChip() {
  const { total, isLoading } = useRecipesContext();
  const [isOpen, setIsOpen] = useState(false);
  const isVisibleByCount = !isLoading && total > 0;

  const { isVisible } = useAutoHide();

  if (!isVisibleByCount) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="chip"
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none fixed inset-x-0 bottom-8 z-50 hidden justify-center md:flex"
          exit={{ opacity: 0, y: 24 }}
          initial={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25 }}
        >
          <div className="pointer-events-auto">
            <div className="pointer-events-auto">
              <Button
                className="h-8 rounded-full border border-white/20 bg-black/50 px-4 py-0 text-white shadow backdrop-blur transition-colors hover:bg-black/80 data-[hover=true]:bg-black/80"
                radius="full"
                size="sm"
                variant="flat"
                onPress={() => setIsOpen(true)}
              >
                <span className="text-sm">
                  {total} {total === 1 ? "recipe" : "recipes"}
                </span>
              </Button>
              <FiltersPanel open={isOpen} onOpenChange={setIsOpen} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
