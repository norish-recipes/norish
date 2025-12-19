"use client";

import { useCallback } from "react";
import { AnimatePresence } from "motion/react";
import { Accordion, AccordionItem, Button } from "@heroui/react";
import { CheckIcon } from "@heroicons/react/16/solid";

import { useGroceriesContext } from "../context";

import { GroceryItem } from "./grocery-item";

import { GroceryDto } from "@/types";

function PendingGroceries({ groceries }: { groceries: GroceryDto[] }) {
  const { toggleGroceries, toggleRecurringGrocery } = useGroceriesContext();

  const completeAll = useCallback(() => {
    const regularIds = groceries.filter((g) => !g.isDone && !g.recurringGroceryId).map((g) => g.id);
    const recurringItems = groceries.filter((g) => !g.isDone && g.recurringGroceryId);

    if (regularIds.length) {
      toggleGroceries(regularIds, true);
    }
    for (const g of recurringItems) {
      toggleRecurringGrocery(g.recurringGroceryId!, g.id, true);
    }
  }, [groceries, toggleGroceries, toggleRecurringGrocery]);

  return (
    <div className="relative">
      <Accordion defaultExpandedKeys={["pending"]} variant="shadow">
        <AccordionItem
          key="pending"
          aria-label="To Buy"
          title={
            <span className="text-lg font-semibold">
              To buy ({groceries.filter((g) => !g.isDone).length})
            </span>
          }
        >
          <AnimatePresence>
            {groceries.map((item, index) => (
              <GroceryItem key={item.id} id={item.id} index={index} totalItems={groceries.length} />
            ))}

            {groceries.length === 0 && (
              <p className="text-default-500 py-2 text-center text-base">All done!</p>
            )}
          </AnimatePresence>
        </AccordionItem>
      </Accordion>
      {groceries.length > 0 && (
        <div className="absolute top-[13px] right-8">
          <Button
            className="text-primary hover:text-primary-500"
            size="sm"
            startContent={<CheckIcon className="h-4 w-4" />}
            variant="light"
            onPress={completeAll}
          >
            All done
          </Button>
        </div>
      )}
    </div>
  );
}

export default PendingGroceries;
