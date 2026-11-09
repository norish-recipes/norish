"use client";

import type { ComponentProps } from "react";
import { useId } from "react";
import { DndContext as DndKitContext } from "@dnd-kit/core";

/**
 * dnd-kit's `DndContext` with a `useId` id. Without one it numbers its aria-describedby from a
 * counter the server and client don't share.
 */
export function DndContext(props: Omit<ComponentProps<typeof DndKitContext>, "id">) {
  return <DndKitContext id={useId()} {...props} />;
}
