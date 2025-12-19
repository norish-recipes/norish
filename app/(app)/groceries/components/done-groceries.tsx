"use client";

import { motion, AnimatePresence } from "motion/react";
import { Accordion, AccordionItem, Checkbox, Button, Divider } from "@heroui/react";
import { TrashIcon } from "@heroicons/react/20/solid";

import { useGroceriesContext } from "../context";

import { RecurrencePill } from "./recurrence-pill";

import { GroceryDto } from "@/types";

export default function DoneGroceries({ groceries }: { groceries: GroceryDto[] }) {
  const {
    toggleGroceries,
    toggleRecurringGrocery,
    deleteGroceries,
    getRecurringGroceryForGrocery,
  } = useGroceriesContext();

  const markUndone = (id: string) => {
    const grocery = groceries.find((g) => g.id === id);

    if (!grocery) return;

    if (grocery.recurringGroceryId) {
      toggleRecurringGrocery(grocery.recurringGroceryId, id, false);
    } else {
      toggleGroceries([id], false);
    }
  };

  const deleteAllCompleted = () => {
    const ids = groceries.map((g) => g.id);

    deleteGroceries(ids);
  };

  return (
    <div className="relative">
      <Accordion defaultExpandedKeys={[]} variant="shadow">
        <AccordionItem
          key="done"
          aria-label="Completed"
          title={
            <div className="flex items-center justify-between pr-14">
              {" "}
              {/* reserve space for button */}
              <span className="text-lg font-semibold">Bought ({groceries.length})</span>
            </div>
          }
        >
          {groceries.length === 0 && (
            <p className="text-default-500 py-2 text-center text-base">All done!</p>
          )}

          <AnimatePresence>
            {groceries.map((item, index) => (
              <motion.div key={item.id} layout>
                <div className="flex items-start justify-between px-2 py-1">
                  <div className="flex flex-1 items-start gap-2">
                    <Checkbox
                      isSelected
                      className="mt-[-5px]"
                      radius="sm"
                      onChange={() => markUndone(item.id)}
                    />
                    <div className="relative ml-1 flex flex-1 flex-col gap-1">
                      <motion.span
                        animate={{ opacity: 1 }}
                        className="text-default-500 line-through"
                        initial={{ opacity: 0.6 }}
                        transition={{ duration: 0.2 }}
                      >
                        {item.name}
                      </motion.span>

                      {/* Show RecurrencePill for recurring items */}
                      {item.recurringGroceryId &&
                        (() => {
                          const recurring = getRecurringGroceryForGrocery(item.id);

                          if (!recurring) return null;

                          return (
                            <RecurrencePill
                              subtle
                              recurringGrocery={recurring}
                              showRemove={false}
                            />
                          );
                        })()}
                    </div>
                  </div>

                  <TrashIcon
                    className="text-default-500 hover:text-danger ml-1 h-5 w-5 cursor-pointer transition-colors"
                    onClick={() => deleteGroceries([item.id])}
                  />
                </div>

                {index !== groceries.length - 1 && (
                  <div className="flex justify-center">
                    <Divider className="bg-default-200/40 w-[90%]" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </AccordionItem>
      </Accordion>

      {/* Delete all button */}
      {groceries.length > 0 && (
        <div className="absolute top-[13px] right-8">
          <Button
            className="text-danger hover:text-danger-500"
            size="sm"
            startContent={<TrashIcon className="h-4 w-4" />}
            variant="light"
            onPress={deleteAllCompleted}
          >
            Delete all
          </Button>
        </div>
      )}
    </div>
  );
}
