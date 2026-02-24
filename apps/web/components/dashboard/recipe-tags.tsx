"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chip } from "@heroui/react";
import { motion, useMotionValue } from "motion/react";

import { isAllergenTag, sortTagsWithAllergyPriority } from "@norish/shared/lib/helpers";
import { cssGlassBackdropChip } from "@norish/web/config/css-tokens";

interface RecipeTagsProps {
  tags: { name: string }[];
  /** List of allergy tag names - these will be styled as warnings and sorted first */
  allergies?: string[];
}

export default function RecipeTags({ tags, allergies = [] }: RecipeTagsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragLimit, setDragLimit] = useState(0);
  const x = useMotionValue(0);

  // Pre-compute allergySet for O(1) lookups
  const allergySet = useMemo(() => new Set(allergies.map((a) => a.toLowerCase())), [allergies]);

  // Sort tags: allergens first, then rest alphabetically
  const sortedTags = useMemo(() => {
    return sortTagsWithAllergyPriority(tags, allergies);
  }, [tags, allergies]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const update = () => setDragLimit(el.scrollWidth - el.offsetWidth);

    update();

    window.addEventListener("resize", update);

    return () => window.removeEventListener("resize", update);
  }, [tags]);

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 overflow-hidden p-2"
      role="presentation"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <motion.div
        ref={containerRef}
        className="flex cursor-grab gap-2 active:cursor-grabbing"
        drag="x"
        dragConstraints={{ left: -dragLimit, right: 0 }}
        dragElastic={0.1}
        style={{ x }}
      >
        {sortedTags.map((t, i) => {
          const isAllergen = isAllergenTag(t.name, allergySet);

          return (
            <Chip
              key={i}
              className={`shrink-0 ${
                isAllergen
                  ? "bg-warning/80 text-warning-foreground backdrop-blur-md"
                  : `text-white ${cssGlassBackdropChip}`
              }`}
              size="sm"
              variant="flat"
            >
              {t.name}
            </Chip>
          );
        })}
      </motion.div>
    </div>
  );
}
