"use client";

import type { ButtonProps } from "@heroui/react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { usePanelPortalContainer } from "@/components/Panel/Panel";
import {
  ArrowPathIcon,
  ArrowRightIcon,
  CheckIcon,
  DocumentDuplicateIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import { Button, Tooltip } from "@heroui/react";

type ActionIcon = ComponentType<SVGProps<SVGSVGElement>>;

type ActionKind =
  | "add"
  | "apply"
  | "cancel"
  | "create"
  | "decrease"
  | "delete"
  | "dismiss"
  | "done"
  | "duplicate"
  | "edit"
  | "increase"
  | "merge"
  | "random"
  | "remove"
  | "reset"
  | "save";

type ActionConfig = {
  icon: ActionIcon;
  variant: ButtonProps["variant"];
  className?: string;
};

// HeroUI has no warning variant; this is danger-soft's recipe in the warning tokens.
const WARNING_SOFT =
  "[--button-bg:var(--warning-soft)] [--button-bg-hover:var(--warning-soft-hover)] [--button-bg-pressed:var(--warning-soft-hover)] [--button-fg:var(--warning-soft-foreground)]";

const ACTION_CONFIG: Record<ActionKind, ActionConfig> = {
  add: { icon: PlusIcon, variant: "primary" },
  apply: { icon: CheckIcon, variant: "primary" },
  cancel: { icon: XMarkIcon, variant: "tertiary" },
  create: { icon: PlusIcon, variant: "primary" },
  decrease: { icon: MinusIcon, variant: "tertiary" },
  delete: { icon: TrashIcon, variant: "danger-soft" },
  dismiss: { icon: XMarkIcon, variant: "tertiary" },
  done: { icon: CheckIcon, variant: "primary" },
  duplicate: { icon: DocumentDuplicateIcon, variant: "tertiary" },
  edit: { icon: PencilIcon, variant: "tertiary" },
  increase: { icon: PlusIcon, variant: "tertiary" },
  merge: { icon: ArrowRightIcon, variant: "tertiary" },
  random: { icon: ArrowPathIcon, variant: "primary" },
  remove: { icon: XMarkIcon, variant: "danger-soft" },
  reset: { icon: ArrowPathIcon, variant: "tertiary", className: WARNING_SOFT },
  save: { icon: CheckIcon, variant: "primary" },
};

function classNames(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ActionButtonProps = Omit<ButtonProps, "children" | "className"> & {
  action: ActionKind;
  className?: string;
  children: ReactNode;
  showIcon?: boolean;
};

/** True for the start button of an ActionButtonGroup whose labels do not fit on one row. */
const IconOnlyContext = createContext(false);

export function ActionButton({
  action,
  children,
  className,
  showIcon,
  variant,
  ...props
}: ActionButtonProps) {
  const config = ACTION_CONFIG[action];
  const Icon = config.icon;
  const iconOnly = useContext(IconOnlyContext);

  return (
    <Button
      className={classNames(iconOnly ? undefined : "min-w-24", config.className, className)}
      isIconOnly={iconOnly}
      variant={variant ?? config.variant}
      {...props}
    >
      {(iconOnly || showIcon !== false) && <Icon className="size-4" />}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </Button>
  );
}

type IconActionButtonProps = Omit<
  ButtonProps,
  "aria-label" | "children" | "className" | "isIconOnly"
> & {
  action: ActionKind;
  className?: string;
  label: string;
  /** An icon that says more than the action's own, where one does. */
  icon?: ActionIcon;
  tooltipPlacement?: "top" | "bottom" | "left" | "right";
};

export function IconActionButton({
  action,
  className,
  label,
  icon,
  tooltipPlacement = "top",
  variant,
  ...props
}: IconActionButtonProps) {
  const config = ACTION_CONFIG[action];
  const Icon = icon ?? config.icon;
  const portalContainer = usePanelPortalContainer();

  return (
    <Tooltip delay={0}>
      <Button
        isIconOnly
        aria-label={label}
        className={classNames(config.className, className)}
        variant={variant ?? config.variant}
        {...props}
      >
        <Icon className="size-4" />
      </Button>
      <Tooltip.Content UNSTABLE_portalContainer={portalContainer} placement={tooltipPlacement}>
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

/**
 * A panel footer's buttons. `start` holds the destructive one (Delete, Remove), pinned left;
 * the rest sit together at the end, primary last. When the labels do not fit on one row,
 * the start button drops its label to an icon (its name stays for screen readers).
 */
export function ActionButtonGroup({
  children,
  className,
  start,
}: {
  children: ReactNode;
  className?: string;
  start?: ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // The start button's width with its label, measured while it shows one, so the
  // decision to go back to a label is made against the labelled width, not the icon's.
  const labelledStartWidth = useRef(0);
  const [iconOnly, setIconOnly] = useState(false);
  const hasStart = Boolean(start);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const startEl = startRef.current;
    const end = endRef.current;

    if (!row || !startEl || !end) return;

    const fit = () => {
      if (!iconOnly) labelledStartWidth.current = startEl.offsetWidth;
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;

      setIconOnly(labelledStartWidth.current + gap + end.offsetWidth > row.clientWidth);
    };

    fit();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(fit);

    observer.observe(row);
    observer.observe(startEl);
    observer.observe(end);

    return () => observer.disconnect();
  }, [iconOnly, hasStart]);

  return (
    <div ref={rowRef} className={classNames("flex w-full flex-wrap items-center gap-2", className)}>
      {start ? (
        <div ref={startRef} className="flex">
          <IconOnlyContext.Provider value={iconOnly}>{start}</IconOnlyContext.Provider>
        </div>
      ) : null}
      <div ref={endRef} className="ms-auto flex flex-wrap items-center justify-end gap-2">
        {children}
      </div>
    </div>
  );
}
