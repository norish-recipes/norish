"use client";

import type { RecurrencePattern } from "@/types/recurrence";

import { useEffect, useState, useRef, memo } from "react";
import { motion } from "motion/react";
import { Checkbox, Divider } from "@heroui/react";

import { useGroceriesContext } from "../context";

import { RecurrencePill } from "./recurrence-pill";

import { EditGroceryPanel } from "@/components/Panel/consumers";
import { RecurrencePanel } from "@/components/Panel/consumers";

type GroceryItemProps = {
  id: string;
  index: number;
  totalItems: number;
};

function GroceryItemComponent({ id, index, totalItems }: GroceryItemProps) {
  const {
    groceries,
    recurringGroceries,
    toggleGroceries,
    toggleRecurringGrocery,
    updateGrocery,
    updateRecurringGrocery,
    deleteGroceries,
    createRecurringGrocery,
  } = useGroceriesContext();

  const item = groceries.find((g) => g.id === id);

  const [isCompleting, setIsCompleting] = useState(false);
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [recurrencePanelOpen, setRecurrencePanelOpen] = useState(false);

  // Ref to store timer IDs for cleanup
  const toggleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset completing animation when item appears as checked (for recurring items)
  useEffect(() => {
    if (item?.isDone && isCompleting) {
      const timer = setTimeout(() => {
        setIsCompleting(false);
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [item?.isDone, isCompleting]);

  useEffect(() => {
    return () => {
      if (toggleTimerRef.current) {
        clearTimeout(toggleTimerRef.current);
      }
    };
  }, []);

  if (!item) return null;

  const recurringGrocery = item.recurringGroceryId
    ? recurringGroceries.find((r) => r.id === item.recurringGroceryId) || null
    : null;

  const handleToggle = (isDone: boolean) => {
    if (isDone) {
      setIsCompleting(true);
      toggleTimerRef.current = setTimeout(() => {
        if (item.recurringGroceryId) {
          toggleRecurringGrocery(item.recurringGroceryId, item.id, true);
        } else {
          toggleGroceries([item.id], true);
        }
      }, 850);
    } else {
      // Clear any pending timer
      if (toggleTimerRef.current) {
        clearTimeout(toggleTimerRef.current);
        toggleTimerRef.current = null;
      }
      setIsCompleting(false);
      if (item.recurringGroceryId) {
        toggleRecurringGrocery(item.recurringGroceryId, item.id, false);
      } else {
        toggleGroceries([item.id], false);
      }
    }
  };

  const handleSave = async (itemName: string, pattern: RecurrencePattern | null) => {
    const isRecurring = !!item.recurringGroceryId;

    if (isRecurring) {
      if (!recurringGrocery) return;

      if (pattern) {
        updateRecurringGrocery(recurringGrocery.id, item.id, itemName, pattern);
      } else {
        // Pattern removed, remove recurrence
        updateRecurringGrocery(recurringGrocery.id, item.id, itemName, null);
      }
    } else {
      if (pattern) {
        // Convert to recurring grocery: create first, then delete original to avoid data loss
        await createRecurringGrocery(itemName, pattern);
        deleteGroceries([item.id]);
      } else {
        updateGrocery(item.id, itemName);
      }
    }
  };

  const handleDelete = () => {
    deleteGroceries([item.id]);
    setEditPanelOpen(false);
  };

  const handleDirectRecurrenceSave = async (pattern: RecurrencePattern | null) => {
    const text = [item.amount, item.unit, item.name].filter(Boolean).join(" ");

    if (item.recurringGroceryId && recurringGrocery) {
      await updateRecurringGrocery(recurringGrocery.id, item.id, text, pattern);
    } else if (pattern) {
      await createRecurringGrocery(text, pattern);
      await deleteGroceries([item.id]);
    }

    setRecurrencePanelOpen(false);
  };

  const handleRemoveRecurrence = async () => {
    if (!recurringGrocery) return;
    const text = [item.amount, item.unit, item.name].filter(Boolean).join(" ");

    await updateRecurringGrocery(recurringGrocery.id, item.id, text, null);
  };

  return (
    <>
      <motion.div
        key={item.id}
        layout
        animate={
          isCompleting
            ? { opacity: 0, y: 10, transition: { delay: 0.6, duration: 0.25 } }
            : { opacity: 1, y: 0 }
        }
        className="flex flex-col"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex items-start py-2 md:px-2">
          <Checkbox
            className="mt-[-4px]"
            isSelected={item.isDone || isCompleting}
            radius="sm"
            onChange={() => handleToggle(!item.isDone)}
          />

          <div className="relative ml-2 flex-1">
            <div
              className="w-full cursor-pointer text-left"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                setEditPanelOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setEditPanelOpen(true);
                }
              }}
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`relative inline-block text-base font-semibold transition-colors duration-300 ${isCompleting ? "text-default-500" : ""
                      } ${item.isDone ? "text-default-500 line-through" : ""}`}
                  >
                    {item.name}

                    {isCompleting && (
                      <motion.div
                        animate={{ width: "100%" }}
                        className="bg-default-500 absolute top-1/2 left-0 h-[2px] -translate-y-1/2 rounded"
                        initial={{ width: 0 }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                      />
                    )}
                  </span>

                  {recurringGrocery && (
                    <RecurrencePill
                      recurringGrocery={recurringGrocery}
                      showRemove={true}
                      subtle={item.isDone}
                      onClick={() => setRecurrencePanelOpen(true)}
                      onRemove={handleRemoveRecurrence}
                    />
                  )}
                </div>

                {item.amount && (
                  <span
                    className={`text-sm font-medium ${item.isDone ? "text-default-400" : "text-primary"
                      }`}
                  >
                    {item.amount} {item.unit ?? ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {index !== totalItems - 1 && (
          <div className="flex justify-center">
            <Divider className="bg-default-200/40 w-[90%]" />
          </div>
        )}
      </motion.div>

      {/* Edit Panel */}
      <EditGroceryPanel
        grocery={item}
        open={editPanelOpen}
        recurringGrocery={recurringGrocery}
        onDelete={handleDelete}
        onOpenChange={setEditPanelOpen}
        onSave={handleSave}
      />

      {/* Recurrence Panel */}
      <RecurrencePanel
        initialPattern={
          recurringGrocery
            ? {
              rule: recurringGrocery.recurrenceRule as "day" | "week" | "month",
              interval: recurringGrocery.recurrenceInterval,
              weekday: recurringGrocery.recurrenceWeekday ?? undefined,
            }
            : null
        }
        open={recurrencePanelOpen}
        onOpenChange={setRecurrencePanelOpen}
        onSave={handleDirectRecurrenceSave}
      />
    </>
  );
}

export const GroceryItem = memo(GroceryItemComponent, (prev, next) => {
  return prev.id === next.id && prev.index === next.index && prev.totalItems === next.totalItems;
});
