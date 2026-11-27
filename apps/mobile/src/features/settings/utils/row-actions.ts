import type { Ionicons } from "@/components/icon";
import type { ComponentProps } from "react";

/** What a settings row's long-press action does; each has one colour and icon everywhere. */
export type SettingsActionKind =
  "delete" | "kick" | "revoke" | "disable" | "enable" | "reactivate" | "admin" | "copy" | "unlink";

/** `danger` is red, `shop` yellow, `accent` green, and `plain` the foreground. */
export type ActionTone = "danger" | "shop" | "accent" | "plain";

type Look = { tone: ActionTone; icon: ComponentProps<typeof Ionicons>["name"]; symbol: string };

const LOOKS: Record<SettingsActionKind, Look> = {
  delete: { tone: "danger", icon: "trash-outline", symbol: "trash" },
  kick: { tone: "danger", icon: "person-remove-outline", symbol: "person.badge.minus" },
  unlink: { tone: "danger", icon: "unlink-outline", symbol: "link.badge.minus" },
  revoke: { tone: "shop", icon: "pause-outline", symbol: "pause" },
  disable: { tone: "shop", icon: "pause-outline", symbol: "pause" },
  enable: { tone: "accent", icon: "play-outline", symbol: "play" },
  reactivate: { tone: "accent", icon: "play-outline", symbol: "play" },
  admin: { tone: "accent", icon: "shield-checkmark-outline", symbol: "checkmark.shield" },
  copy: { tone: "plain", icon: "copy-outline", symbol: "doc.on.doc" },
};

export type SettingsRowAction = {
  kind: SettingsActionKind;
  label: string;
  onPress: () => void;
};

export const actionLook = (kind: SettingsActionKind): Look => LOOKS[kind];

const removes = (action: SettingsRowAction) => LOOKS[action.kind].tone === "danger";

/** The one order of a row's actions: the red one that removes something last. */
export const orderActions = (actions: SettingsRowAction[]) => [
  ...actions.filter((action) => !removes(action)),
  ...actions.filter(removes),
];

/** The long-press menu's actions, in that order: none while Offline, as no settings write is Queued. */
export const menuActions = (actions: SettingsRowAction[], offline: boolean) =>
  offline ? [] : orderActions(actions);

/** Whether a row's own press is held back: only a press that is a write, and only while Offline. */
export const writeBlocked = (write: boolean, offline: boolean) => write && offline;
