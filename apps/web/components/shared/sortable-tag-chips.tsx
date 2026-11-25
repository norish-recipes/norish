"use client";

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { CSSProperties, ReactNode } from "react";
import { useId, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableTagItemProps {
  tag: string;
  label?: string;
  onActivate: (tag: string) => void;
}

function SortableTagItem({ tag, label, onActivate }: SortableTagItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tag,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    // A Tag on the recipe is a chip that names a thing, and it is active:
    // filled in the accent colour, like a selected filter chip.
    <button
      ref={setNodeRef}
      aria-label={label}
      className="bg-accent text-accent-foreground hover:bg-accent/90 inline-flex cursor-grab touch-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors active:cursor-grabbing"
      style={style}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onActivate(tag);
      }}
      {...attributes}
      {...listeners}
    >
      <span>{tag}</span>
    </button>
  );
}

interface SortableTagChipsProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** What a click on a chip does: the pointer sensor's distance tells it from a drag. */
  onActivate: (tag: string) => void;
  /** The accessible name of a chip, when its click does something its text does not say. */
  chipLabel?: (tag: string) => string;
  /** The field that follows the chips, inline. */
  children?: ReactNode;
}

/** The recipe's Tags as chips the reader reorders by dragging, with the input after them. */
export function SortableTagChips({
  value,
  onChange,
  onActivate,
  chipLabel,
  children,
}: SortableTagChipsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const dndId = useId();
  const sensors = useSensors(
    // Five pixels of movement before a drag starts, so a click stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // A press delay on touch tells a drag from a scroll.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);

    if (over && active.id !== over.id) {
      onChange(arrayMove(value, value.indexOf(String(active.id)), value.indexOf(String(over.id))));
    }
  };

  return (
    <>
      <DndContext
        collisionDetection={closestCenter}
        id={dndId}
        sensors={sensors}
        onDragEnd={handleDragEnd}
        onDragStart={({ active }: DragStartEvent) => setActiveId(String(active.id))}
      >
        <SortableContext items={value} strategy={horizontalListSortingStrategy}>
          {value.map((tag) => (
            <SortableTagItem key={tag} label={chipLabel?.(tag)} tag={tag} onActivate={onActivate} />
          ))}
        </SortableContext>

        {/* The chip follows the cursor while it is dragged. */}
        <DragOverlay>
          {activeId ? (
            <div className="bg-accent text-accent-foreground inline-flex cursor-grabbing items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg">
              <span>{activeId}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {children}
    </>
  );
}
