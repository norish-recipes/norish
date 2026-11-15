"use client";

import type { ButtonProps } from "@heroui/react";
import type { ReactNode } from "react";
import { cssAIGradientText, cssAIIconColor } from "@/config/css-tokens";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";
import { twMerge } from "tailwind-merge";

type AIButtonProps = Omit<ButtonProps, "children" | "className"> & {
  children: ReactNode;
  className?: string;
};

// The one look for "ask the AI" across the app, taken from the recipe actions
// menu: a fuchsia sparkle and a gradient label. Everything else is a Button.
export function AIButton({ children, className, ...props }: AIButtonProps) {
  return (
    <Button className={twMerge("rounded-full", className)} {...props}>
      <SparklesIcon className={twMerge("size-4", cssAIIconColor)} />
      <span className={twMerge("font-medium", cssAIGradientText)}>{children}</span>
    </Button>
  );
}
