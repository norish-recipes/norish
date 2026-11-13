"use client";

import type { ReactNode } from "react";
import { createContext, use } from "react";

import type { CompatibleMessageTranslator } from "@norish/i18n";
import type { User } from "@norish/shared/contracts";
import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";

import type { OfflineEngine } from "../offline/engine";

type ToastSeverity = "default" | "success" | "warning" | "danger";

type ToastAdapter = {
  show: (toast: {
    severity: ToastSeverity;
    title: string;
    description?: string;
    /** What the toast is about, such as the imported recipe's name; an app may show it when there is no description. */
    subject?: string;
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

/** Why the reader leaves the signed-in app: their own Sign-out, or Session Expiry. */
export type LeaveReason = "sign-out" | "expiry";

/** Which copy of the session `endSession` ends: the server's and this device's, or this device's alone. */
export type SessionScope = "everywhere" | "device";

/** Who the app's auth client says is signed in; `isPending` until it answers. */
export type PlatformSession = { user: User | null; isPending: boolean };

/** What shared code needs from the app it runs in. Each app mounts one. */
export type PlatformAdapter = {
  toast: ToastAdapter;
  navigation: {
    toHome: () => void;
    toRecipe: (id: string) => void;
  };
  /** Tells the reader an operation failed, under `title` if given; `context` names where, for the log. */
  showError: (error: unknown, context: string, title?: string) => void;
  storage: PlatformStorage;
  deviceKind: DeviceKind;
  session: PlatformSession;
  /** Ends the session in `scope`; rejects when it could not. */
  endSession: (scope: SessionScope) => Promise<void>;
  /** Takes the signed-out reader to sign-in. */
  leave: (reason: LeaveReason) => void;
  offlineEngine: Pick<OfflineEngine, "clearForSignOut">;
};

/** Tells the reader the server refused a write, with its reason when it named one. */
export function showRefusal(
  showError: PlatformAdapter["showError"],
  answer: { error?: string },
  context: string
): void {
  showError(answer.error ?? "Unknown error", context);
}

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
