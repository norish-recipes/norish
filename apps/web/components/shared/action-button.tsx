"use client";

import type { ButtonProps } from "@heroui/react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  ArrowPathIcon,
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
  | "done"
  | "duplicate"
  | "edit"
  | "increase"
  | "random"
  | "remove"
  | "reset"
  | "save";

type ActionConfig = {
  icon: ActionIcon;
  showIcon: boolean;
  variant: ButtonProps["variant"];
};

const ACTION_CONFIG: Record<ActionKind, ActionConfig> = {
  add: { icon: PlusIcon, showIcon: true, variant: "primary" },
  apply: { icon: CheckIcon, showIcon: true, variant: "primary" },
  cancel: { icon: XMarkIcon, showIcon: false, variant: "tertiary" },
  create: { icon: PlusIcon, showIcon: true, variant: "primary" },
  decrease: { icon: MinusIcon, showIcon: true, variant: "tertiary" },
  delete: { icon: TrashIcon, showIcon: true, variant: "danger-soft" },
  done: { icon: CheckIcon, showIcon: true, variant: "primary" },
  duplicate: { icon: DocumentDuplicateIcon, showIcon: true, variant: "tertiary" },
  edit: { icon: PencilIcon, showIcon: true, variant: "tertiary" },
  increase: { icon: PlusIcon, showIcon: true, variant: "tertiary" },
  random: { icon: ArrowPathIcon, showIcon: true, variant: "primary" },
  remove: { icon: XMarkIcon, showIcon: true, variant: "danger-soft" },
  reset: { icon: ArrowPathIcon, showIcon: true, variant: "danger-soft" },
  save: { icon: CheckIcon, showIcon: true, variant: "primary" },
};

function classNames(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ActionButtonProps = Omit<ButtonProps, "children"> & {
  action: ActionKind;
  children: ReactNode;
  showIcon?: boolean;
};

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
  const shouldShowIcon = showIcon ?? config.showIcon;

  return (
    <Button
      className={classNames("min-w-24", className)}
      variant={variant ?? config.variant}
      {...props}
    >
      {shouldShowIcon && <Icon className="size-4" />}
      {children}
    </Button>
  );
}

type IconActionButtonProps = Omit<ButtonProps, "aria-label" | "children" | "isIconOnly"> & {
  action: ActionKind;
  label: string;
  tooltipPlacement?: "top" | "bottom" | "left" | "right";
};

export function IconActionButton({
  action,
  className,
  label,
  tooltipPlacement = "top",
  variant,
  ...props
}: IconActionButtonProps) {
  const config = ACTION_CONFIG[action];
  const Icon = config.icon;

  return (
    <Tooltip delay={0}>
      <Button
        isIconOnly
        aria-label={label}
        className={className}
        variant={variant ?? config.variant}
        {...props}
      >
        <Icon className="size-4" />
      </Button>
      <Tooltip.Content placement={tooltipPlacement}>
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

export function ActionButtonGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={classNames("flex flex-wrap items-center justify-end gap-2", className)}>
      {children}
    </div>
  );
}
