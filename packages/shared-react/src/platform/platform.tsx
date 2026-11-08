"use client";

import type { ReactNode } from "react";
import { createContext, use } from "react";

import type { CompatibleMessageTranslator } from "@norish/i18n";
import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";

export type ToastSeverity = "default" | "success" | "warning" | "danger";

export type ToastAdapter = {
  show: (toast: {
    severity: ToastSeverity;
    title: string;
    description?: string;
    actionLabel?: string;
    onActionPress?: () => void;
  }) => void;
  translate: CompatibleMessageTranslator;
};

/** Key-value storage, the shape zustand's `persist` writes through. */
export type PlatformStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

/** What shared code needs from the app it runs in. Each app mounts one. */
export type PlatformAdapter = {
  toast: ToastAdapter;
  navigation: {
    toHome: () => void;
    toRecipe: (id: string) => void;
  };
  /** Tells the reader an operation failed; `context` names where, for the log. */
  showError: (error: unknown, context: string) => void;
  storage: PlatformStorage;
  deviceKind: DeviceKind;
};

const PlatformContext = createContext<PlatformAdapter | null>(null);

export function PlatformProvider({
  adapter,
  children,
}: {
  adapter: PlatformAdapter;
  children: ReactNode;
}) {
  return <PlatformContext value={adapter}>{children}</PlatformContext>;
}

export function usePlatform(): PlatformAdapter {
  const adapter = use(PlatformContext);

  if (!adapter) {
    throw new Error("usePlatform must be used within PlatformProvider");
  }

  return adapter;
}
