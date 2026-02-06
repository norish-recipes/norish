"use client";

import React from "react";
import { Button } from "@heroui/react";
import { SparklesIcon } from "@heroicons/react/16/solid";

import { cssAIGradientBg } from "@/config/css-tokens";

interface AIActionButtonProps {
  label: string;
  loadingLabel?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  onPress: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Generic AI action button with gradient styling.
 * Used for AI-powered features like auto-tagging, nutrition estimation, etc.
 */
export default function AIActionButton({
  label,
  loadingLabel,
  isLoading = false,
  isDisabled = false,
  onPress,
  size = "sm",
  className = "",
}: AIActionButtonProps) {
  return (
    <Button
      className={`${cssAIGradientBg} shadow-md transition-all duration-200 data-[hover=true]:opacity-85 data-[hover=true]:shadow-lg data-[pressed=true]:scale-[0.98] ${className}`}
      isDisabled={isDisabled || isLoading}
      size={size}
      startContent={<SparklesIcon className="h-4 w-4" />}
      onPress={onPress}
    >
      {isLoading && loadingLabel ? loadingLabel : label}
    </Button>
  );
}
