"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { PlusIcon } from "@heroicons/react/16/solid";
import { motion } from "motion/react";

import { useGroceriesContext } from "../context";

import { AddGroceryPanel } from "@/components/Panel/consumers";
import { useAutoHide } from "@/hooks/auto-hide";

export default function AddGroceryButton() {
  const { createGrocery, createRecurringGrocery } = useGroceriesContext();
  const [panelOpen, setPanelOpen] = useState(false);
  const { isVisible, show } = useAutoHide({ disabled: panelOpen });

  return (
    <>
      <motion.div
        animate={{ y: isVisible ? 0 : 120, opacity: isVisible ? 1 : 0 }}
        className="pointer-events-none fixed left-1/2 -translate-x-1/2 will-change-transform"
        initial={false}
        style={{
          bottom: "calc(max(env(safe-area-inset-bottom), 1rem) + 3.75rem)",
        }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
        <motion.div
          className="pointer-events-auto"
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            className="shadow-lg"
            color="primary"
            radius="full"
            size="lg"
            startContent={<PlusIcon className="h-5 w-5" />}
            onPress={() => {
              setPanelOpen(true);
              show();
            }}
          >
            Add items
          </Button>
        </motion.div>
      </motion.div>

      {/* Creation Panel */}
      <AddGroceryPanel
        open={panelOpen}
        onCreate={createGrocery}
        onCreateRecurring={createRecurringGrocery}
        onOpenChange={setPanelOpen}
      />
    </>
  );
}
