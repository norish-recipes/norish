import { describe, expect, it } from "vitest";

import type { SettingsActionKind, SettingsRowAction } from "../utils/row-actions";
import {
  actionLook,
  menuActions,
  orderActions,
  swipeActions,
  writeBlocked,
} from "../utils/row-actions";
import { versionLine } from "../utils/version-line";

const act = (kind: SettingsActionKind): SettingsRowAction => ({
  kind,
  label: kind,
  onPress: () => undefined,
});
const tones = (kinds: SettingsActionKind[]) => kinds.map((kind) => actionLook(kind).tone);

describe("settings row actions", () => {
  it("colours delete and kick red, revoke and disable yellow, the rest green", () => {
    expect(tones(["delete", "kick"])).toEqual(["danger", "danger"]);
    expect(tones(["revoke", "disable"])).toEqual(["shop", "shop"]);
    expect(tones(["enable", "reactivate", "admin"])).toEqual(["accent", "accent", "accent"]);
  });

  it("puts the red action that removes something last, keeping the others' order", () => {
    const kinds = (actions: SettingsRowAction[]) => actions.map((a) => a.kind);

    expect(kinds(orderActions([act("kick"), act("admin")]))).toEqual(["admin", "kick"]);
    expect(kinds(orderActions([act("delete"), act("copy"), act("revoke")]))).toEqual([
      "copy",
      "revoke",
      "delete",
    ]);
    expect(kinds(orderActions([act("unlink")]))).toEqual(["unlink"]);
  });

  it("keeps Copy out of the swipe but in the menu, both in the same order", () => {
    const actions = [act("delete"), act("copy"), act("disable")];

    expect(swipeActions(actions).map((a) => a.kind)).toEqual(["disable", "delete"]);
    expect(menuActions(actions, false).map((a) => a.kind)).toEqual(["copy", "disable", "delete"]);
  });

  it("offers no menu while Offline", () => {
    expect(menuActions([act("delete")], true)).toEqual([]);
  });

  it("holds back a write press Offline, and leaves a navigation press live", () => {
    expect(writeBlocked(true, true)).toBe(true);
    expect(writeBlocked(true, false)).toBe(false);
    expect(writeBlocked(false, true)).toBe(false);
  });
});

describe("versionLine", () => {
  it("joins the app version, build and server", () => {
    expect(versionLine("1.0", "12", "Server 0.28.0")).toBe("1.0 (12) · Server 0.28.0");
  });

  it("leaves out a part that is missing instead of inventing it", () => {
    expect(versionLine("1.0", null, "Server 0.28.0")).toBe("1.0 · Server 0.28.0");
    expect(versionLine("1.0", "12", null)).toBe("1.0 (12)");
    expect(versionLine("1.0", null, null)).toBe("1.0");
    expect(versionLine(null, null, "Server 0.28.0")).toBe("Server 0.28.0");
  });
});
