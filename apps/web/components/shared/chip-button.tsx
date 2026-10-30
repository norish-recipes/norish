"use client";

import type { ComponentProps } from "react";
import { Chip } from "@heroui/react";

type ChipButtonProps = Omit<ComponentProps<typeof Chip<"button">>, "render" | "type">;

/** A Chip that is pressed rather than read: a filter, a pick, a timer. */
export function ChipButton(props: ChipButtonProps) {
  return <Chip<"button"> {...props} render={(chip) => <button {...chip} />} type="button" />;
}
