import { beforeEach, describe, expect, it, vi } from "vitest";

import { cleanEquipmentText, stripEquipmentPreparation } from "@norish/db/repositories/equipment";
import * as equipmentRepo from "@norish/db/repositories/equipment";
import { DEFAULT_EQUIPMENT } from "@norish/db/repositories/equipment-defaults";
import { foldName } from "@norish/shared/lib/fold-name";

import {
  createEquipment,
  deleteEquipment,
  EquipmentEditError,
  mayEditEquipmentRow,
  mergeEquipment,
  saveEquipmentDraft,
} from "../catalogue";
import { equipmentIconAddress } from "../icons";

vi.mock("@norish/db/drizzle", () => ({
  withTransaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getIngredientPermissionPolicy: vi.fn(async () => ({ edit: "household" })),
}));

describe("equipment catalogue helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("cleans equipment text and strips preparation notes", () => {
    expect(cleanEquipmentText("  <b>Frying   pan</b>  ")).toBe("Frying pan");
    expect(stripEquipmentPreparation("Springform (26 cm)")).toBe("Springform");
    expect(stripEquipmentPreparation("Frying pan, large non-stick")).toBe("Frying pan");
    expect(stripEquipmentPreparation("Baking sheet [lined]")).toBe("Baking sheet");
  });

  it("formats equipment icon addresses only when an icon file is present", () => {
    expect(equipmentIconAddress(null)).toBeNull();
    expect(equipmentIconAddress("abc123def4567890.webp")).toBe(
      "/equipment-icons/abc123def4567890.webp"
    );
  });

  it("evaluates equipment edit permissions across levels", () => {
    const admin = { userId: "u1", householdUserIds: ["u1", "u2"], isServerAdmin: true };
    const member = { userId: "u1", householdUserIds: ["u1", "u2"], isServerAdmin: false };
    const stranger = { userId: "u3", householdUserIds: ["u3"], isServerAdmin: false };

    expect(mayEditEquipmentRow("owner", admin, "u2")).toBe(true);
    expect(mayEditEquipmentRow("owner", member, "u1")).toBe(true);
    expect(mayEditEquipmentRow("owner", member, "u2")).toBe(false);
    expect(mayEditEquipmentRow("household", member, "u2")).toBe(true);
    expect(mayEditEquipmentRow("household", member, null)).toBe(true);
    expect(mayEditEquipmentRow("household", stranger, "u1")).toBe(false);
    expect(mayEditEquipmentRow("everyone", stranger, "u1")).toBe(true);
  });

  it("ensures every default equipment item has a valid name and non-empty aliases", () => {
    expect(DEFAULT_EQUIPMENT.length).toBeGreaterThanOrEqual(20);
    const ids = new Set<string>();
    const names = new Set<string>();

    for (const item of DEFAULT_EQUIPMENT) {
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);

      const lowerName = item.name.toLowerCase();
      expect(names.has(lowerName)).toBe(false);
      names.add(lowerName);

      expect(foldName(item.name).length).toBeGreaterThan(0);
      expect(item.aliases.length).toBeGreaterThan(0);
    }
  });

  it("creates equipment with its primary name alias and extra aliases", async () => {
    const actor = { userId: "u1", householdUserIds: ["u1"], isServerAdmin: false };
    vi.spyOn(equipmentRepo, "findEquipmentIdByFold").mockResolvedValue(null);
    vi.spyOn(equipmentRepo, "insertCatalogueEquipment").mockResolvedValue({ id: "eq-new" });
    const insertAlias = vi
      .spyOn(equipmentRepo, "insertCatalogueEquipmentAlias")
      .mockResolvedValue({ id: "al-1", text: "Wok", ownerId: "u1" });

    const res = await createEquipment(actor, {
      name: "  Wok  ",
      aliases: ["Wokpfanne", "wok"],
    });

    expect(res).toEqual({ equipmentId: "eq-new" });
    expect(insertAlias).toHaveBeenCalledTimes(2);
  });

  it("refuses deleting equipment that is still in use by a recipe", async () => {
    const actor = { userId: "u1", householdUserIds: ["u1"], isServerAdmin: false };
    vi.spyOn(equipmentRepo, "findCatalogueEquipmentOwner").mockResolvedValue({ ownerId: "u1" });
    vi.spyOn(equipmentRepo, "isEquipmentInUse").mockResolvedValue(true);

    await expect(deleteEquipment(actor, "eq-1")).rejects.toThrowError(
      new EquipmentEditError("ingredient-in-use")
    );
  });

  it("saves equipment draft changes (rename, remove alias, add alias)", async () => {
    const actor = { userId: "u1", householdUserIds: ["u1"], isServerAdmin: false };
    vi.spyOn(equipmentRepo, "findCatalogueEquipmentOwner").mockResolvedValue({ ownerId: "u1" });
    vi.spyOn(equipmentRepo, "renameCatalogueEquipment").mockResolvedValue(true);
    vi.spyOn(equipmentRepo, "findCatalogueEquipmentAliasOwner").mockResolvedValue({
      equipmentId: "eq-1",
      ownerId: "u1",
    });
    vi.spyOn(equipmentRepo, "countEquipmentAliasesOf").mockResolvedValue(2);
    vi.spyOn(equipmentRepo, "isEquipmentAliasInUse").mockResolvedValue(false);
    const delAlias = vi
      .spyOn(equipmentRepo, "deleteCatalogueEquipmentAlias")
      .mockResolvedValue(undefined);
    const insAlias = vi
      .spyOn(equipmentRepo, "insertCatalogueEquipmentAlias")
      .mockResolvedValue({ id: "al-2", text: "Skillet", ownerId: "u1" });

    await saveEquipmentDraft(actor, "eq-1", {
      name: "Frying Pan",
      add: ["Skillet"],
      remove: ["al-old"],
    });

    expect(delAlias).toHaveBeenCalledWith(expect.anything(), "al-old");
    expect(insAlias).toHaveBeenCalledTimes(2);
  });

  it("merges one equipment item into another and refuses self-merge", async () => {
    const actor = { userId: "u1", householdUserIds: ["u1"], isServerAdmin: false };

    await expect(mergeEquipment(actor, "eq-1", "eq-1")).rejects.toThrowError(
      new EquipmentEditError("same-ingredient")
    );

    vi.spyOn(equipmentRepo, "findCatalogueEquipmentOwner").mockResolvedValue({ ownerId: null });
    const mergeSpy = vi.spyOn(equipmentRepo, "mergeCatalogueEquipment").mockResolvedValue(true);

    await mergeEquipment(actor, "eq-source", "eq-target");
    expect(mergeSpy).toHaveBeenCalledWith(expect.anything(), "eq-source", "eq-target");
  });
});
