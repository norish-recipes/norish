"use client";

import type { ComponentPropsWithoutRef, ReactNode, RefObject } from "react";
import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { Button } from "@heroui/react";
import { DropZone as RACDropZone, Text } from "react-aria-components";
import { twMerge } from "tailwind-merge";

export type DropZoneAreaProps = ComponentPropsWithoutRef<typeof RACDropZone>;

type DropZoneContextValue = {
  inputRef: RefObject<HTMLInputElement | null>;
  openFilePicker: () => void;
};

const DropZoneContext = createContext<DropZoneContextValue | null>(null);

function useDropZone() {
  const context = useContext(DropZoneContext);

  if (!context) {
    throw new Error("DropZone compound components must be used within a <DropZone>");
  }

  return context;
}

function DropZoneRoot({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  const inputRef = useRef<HTMLInputElement>(null);
  const openFilePicker = useCallback(() => inputRef.current?.click(), []);
  const value = useMemo(() => ({ inputRef, openFilePicker }), [openFilePicker]);

  return (
    <DropZoneContext.Provider value={value}>
      <div className={twMerge("flex flex-col gap-3", className)} data-slot="drop-zone" {...props}>
        {children}
      </div>
    </DropZoneContext.Provider>
  );
}

function DropZoneArea({ children, className, ...props }: DropZoneAreaProps) {
  return (
    <RACDropZone
      className={twMerge(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-(--border-secondary) px-6 py-8 text-center transition-colors outline-none data-[drop-target]:border-(--accent) data-[drop-target]:bg-(--accent-soft) data-[focus-visible]:ring-2 data-[focus-visible]:ring-(--focus)",
        typeof className === "string" ? className : undefined
      )}
      data-slot="drop-zone-area"
      {...props}
    >
      {children}
    </RACDropZone>
  );
}

function DropZoneIcon({ children, className, ...props }: ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={twMerge(
        "flex items-center justify-center text-(--muted) [&_svg]:size-8",
        className
      )}
      data-slot="drop-zone-icon"
      {...props}
    >
      {children}
    </span>
  );
}

function DropZoneLabel({ children, className, ...props }: ComponentPropsWithoutRef<typeof Text>) {
  return (
    <Text
      className={twMerge("text-sm font-medium text-(--foreground)", className)}
      data-slot="drop-zone-label"
      slot="label"
      {...props}
    >
      {children}
    </Text>
  );
}

function DropZoneDescription({ children, className, ...props }: ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={twMerge("text-xs text-(--muted)", className)}
      data-slot="drop-zone-description"
      {...props}
    >
      {children}
    </span>
  );
}

interface DropZoneTriggerProps extends Omit<ComponentPropsWithoutRef<typeof Button>, "children"> {
  children?: ReactNode;
}

function DropZoneTrigger({ children, className, ...props }: DropZoneTriggerProps) {
  const { openFilePicker } = useDropZone();

  return (
    <Button
      className={twMerge("mt-1", className)}
      data-slot="drop-zone-trigger"
      size="sm"
      variant="outline"
      onPress={openFilePicker}
      {...props}
    >
      {children}
    </Button>
  );
}

interface DropZoneInputProps extends Omit<ComponentPropsWithoutRef<"input">, "onSelect" | "type"> {
  onSelect?: (files: File[]) => void;
}

function DropZoneInput({ accept, className, multiple, onSelect, ...props }: DropZoneInputProps) {
  const { inputRef } = useDropZone();

  return (
    <input
      accept={accept}
      className={twMerge("sr-only", className)}
      data-slot="drop-zone-input"
      multiple={multiple}
      ref={inputRef}
      tabIndex={-1}
      type="file"
      onChange={(event) => {
        const files = event.target.files;

        if (files && files.length > 0) onSelect?.(Array.from(files));
        event.target.value = "";
      }}
      {...props}
    />
  );
}

export const DropZone = Object.assign(DropZoneRoot, {
  Area: DropZoneArea,
  Description: DropZoneDescription,
  Icon: DropZoneIcon,
  Input: DropZoneInput,
  Label: DropZoneLabel,
  Root: DropZoneRoot,
  Trigger: DropZoneTrigger,
});
