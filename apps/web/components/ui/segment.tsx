"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Key, ToggleButtonProps } from "react-aria-components";
import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { twMerge } from "tailwind-merge";

// Size is shared with items through context so `<Segment.Item>` needs no size prop,
// matching the compound API of the component this replaces.
const SizeContext = createContext<SegmentSize>("md");

type SegmentSize = "sm" | "md" | "lg";

const groupSizeClasses: Record<SegmentSize, string> = {
  sm: "p-0.5",
  md: "p-1",
  lg: "p-1",
};

const itemSizeClasses: Record<SegmentSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-4 text-sm",
  lg: "h-10 px-5 text-sm",
};

export interface SegmentProps {
  "aria-label"?: string;
  children: ReactNode;
  className?: string;
  selectedKey?: Key | null;
  size?: SegmentSize;
  onSelectionChange?: (key: Key) => void;
}

function SegmentRoot({
  "aria-label": ariaLabel,
  children,
  className,
  selectedKey,
  size = "md",
  onSelectionChange,
}: SegmentProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties | null>(null);

  const updateIndicator = useCallback(() => {
    const group = groupRef.current;
    const selected = group?.querySelector<HTMLElement>("[data-selected]");

    if (!group || !selected) {
      setIndicatorStyle(null);

      return;
    }

    setIndicatorStyle({
      height: selected.offsetHeight,
      translate: `${selected.offsetLeft}px ${selected.offsetTop}px`,
      width: selected.offsetWidth,
    });
  }, []);

  useLayoutEffect(() => {
    updateIndicator();

    const group = groupRef.current;

    if (!group || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateIndicator);

    observer.observe(group);

    return () => observer.disconnect();
  }, [selectedKey, updateIndicator]);

  return (
    <ToggleButtonGroup
      disallowEmptySelection
      aria-label={ariaLabel}
      className={twMerge(
        "relative inline-flex items-center rounded-[calc(var(--radius-2xl)+0.25rem)] bg-(--default)",
        groupSizeClasses[size],
        className
      )}
      data-slot="segment"
      ref={groupRef}
      selectedKeys={selectedKey != null ? [selectedKey] : []}
      selectionMode="single"
      onSelectionChange={(keys) => {
        const key = [...keys][0];

        if (key != null) onSelectionChange?.(key);
      }}
    >
      {indicatorStyle && (
        <span
          aria-hidden
          className="absolute top-0 left-0 rounded-(--radius-3xl) bg-(--segment) shadow-(--shadow-surface) transition-[translate,width,height] duration-250 motion-reduce:transition-none"
          data-slot="segment-indicator"
          style={indicatorStyle}
        />
      )}
      <SizeContext.Provider value={size}>{children}</SizeContext.Provider>
    </ToggleButtonGroup>
  );
}

export interface SegmentItemProps extends Omit<ToggleButtonProps, "children" | "className"> {
  children?: ReactNode;
  className?: string;
  title?: string;
}

function SegmentItem({ children, className, ...props }: SegmentItemProps) {
  const size = useContext(SizeContext);

  return (
    <ToggleButton
      className={twMerge(
        "group relative z-10 flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap text-(--muted) transition-colors duration-150 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-(--focus) data-[selected]:text-(--segment-foreground) [&_svg]:size-4 [&_svg]:shrink-0 [&:not([data-selected])]:hover:opacity-70",
        itemSizeClasses[size],
        className
      )}
      data-slot="segment-item"
      {...props}
    >
      {children}
    </ToggleButton>
  );
}

function SegmentSeparator({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={twMerge(
        "pointer-events-none absolute top-1/4 left-0 h-1/2 w-px rounded bg-(--muted)/25 transition-opacity group-first-of-type:hidden group-data-[selected]:opacity-0 [[data-selected]+*>&]:opacity-0",
        className
      )}
      data-slot="segment-separator"
    />
  );
}

export const Segment = Object.assign(SegmentRoot, {
  Item: SegmentItem,
  Root: SegmentRoot,
  Separator: SegmentSeparator,
});
