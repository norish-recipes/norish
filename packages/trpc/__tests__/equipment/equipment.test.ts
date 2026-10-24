// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EquipmentEditError } from "@norish/shared-server/equipment/catalogue";

import { equipmentRouter } from "../../src/routers/equipment";
import { createMockAuthedContext, createMockUser } from "../recipes/test-utils";

const mockRepo = vi.hoisted(() => ({
  findEquipmentFor: vi.fn(),
  listEquipmentUses: vi.fn(),
}));

const mockCatalogue = vi.hoisted(() => ({
  listEquipment: vi.fn(),
  createEquipment: vi.fn(),
  saveEquipmentDraft: vi.fn(),
  deleteEquipment: vi.fn(),
  mergeEquipment: vi.fn(),
  uploadEquipmentIcon: vi.fn(),
}));

const mockIcons = vi.hoisted(() => ({
  equipmentIconAddresses: vi.fn(),
}));

vi.mock("@norish/db/repositories/equipment", () => ({
  findEquipmentFor: mockRepo.findEquipmentFor,
  listEquipmentUses: mockRepo.listEquipmentUses,
}));

vi.mock("@norish/shared-server/equipment/catalogue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/shared-server/equipment/catalogue")>();
  return {
    ...actual,
    listEquipment: mockCatalogue.listEquipment,
    createEquipment: mockCatalogue.createEquipment,
    saveEquipmentDraft: mockCatalogue.saveEquipmentDraft,
    deleteEquipment: mockCatalogue.deleteEquipment,
    mergeEquipment: mockCatalogue.mergeEquipment,
    uploadEquipmentIcon: mockCatalogue.uploadEquipmentIcon,
  };
});

vi.mock("@norish/shared-server/equipment/icons", () => ({
  equipmentIconAddresses: mockIcons.equipmentIconAddresses,
}));

describe("equipment router", () => {
  const caller = equipmentRouter.createCaller(createMockAuthedContext(createMockUser()));
  const testId = "11111111-1111-4111-8111-111111111111";
  const targetId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns paginated equipment items from catalogue", async () => {
      const mockItems = [
        {
          id: testId,
          name: "Frying Pan",
          icon: "/equipment-icons/pan.webp",
          ownIcon: true,
          canEdit: true,
          aliases: [{ id: "a1", text: "Bratpfanne", seeded: true, canRemove: true, inUse: false }],
        },
      ];

      mockCatalogue.listEquipment.mockResolvedValueOnce({ items: mockItems, nextOffset: null });

      const result = await caller.list({ search: "Pan" });

      expect(mockCatalogue.listEquipment).toHaveBeenCalledWith(expect.any(Object), {
        search: "Pan",
        match: undefined,
        fields: undefined,
        offset: 0,
      });
      expect(result).toEqual({ items: mockItems, nextCursor: null });
    });
  });

  describe("get", () => {
    it("returns single equipment item when found or null", async () => {
      const item = {
        id: testId,
        name: "Frying Pan",
        icon: null,
        ownIcon: false,
        canEdit: true,
        aliases: [],
      };

      mockCatalogue.listEquipment.mockResolvedValueOnce({ items: [item], nextOffset: null });

      const result = await caller.get({ equipmentId: testId });

      expect(mockCatalogue.listEquipment).toHaveBeenCalledWith(expect.any(Object), {
        id: testId,
      });
      expect(result).toEqual(item);
    });
  });

  describe("create", () => {
    it("creates equipment and returns created equipmentId", async () => {
      mockCatalogue.createEquipment.mockResolvedValueOnce({ equipmentId: testId });

      const result = await caller.create({
        name: "Wok",
        aliases: ["Wokpfanne"],
      });

      expect(mockCatalogue.createEquipment).toHaveBeenCalledWith(expect.any(Object), {
        name: "Wok",
        aliases: ["Wokpfanne"],
      });
      expect(result).toEqual({ equipmentId: testId });
    });

    it("maps EquipmentEditError to TRPCError", async () => {
      mockCatalogue.createEquipment.mockRejectedValueOnce(new EquipmentEditError("name-taken"));

      await expect(caller.create({ name: "Wok" })).rejects.toThrow(
        expect.objectContaining({ code: "CONFLICT", message: "name-taken" })
      );
    });
  });

  describe("saveDraft", () => {
    it("saves draft changes and returns success", async () => {
      mockCatalogue.saveEquipmentDraft.mockResolvedValueOnce(undefined);

      const result = await caller.saveDraft({
        equipmentId: testId,
        name: "Cast Iron Skillet",
        add: ["Gusseisenpfanne"],
        remove: [],
      });

      expect(mockCatalogue.saveEquipmentDraft).toHaveBeenCalledWith(expect.any(Object), testId, {
        name: "Cast Iron Skillet",
        add: ["Gusseisenpfanne"],
        remove: [],
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("remove", () => {
    it("deletes equipment and returns success", async () => {
      mockCatalogue.deleteEquipment.mockResolvedValueOnce(undefined);

      const result = await caller.remove({ equipmentId: testId });

      expect(mockCatalogue.deleteEquipment).toHaveBeenCalledWith(expect.any(Object), testId);
      expect(result).toEqual({ success: true });
    });

    it("maps ingredient-in-use refusal to CONFLICT", async () => {
      mockCatalogue.deleteEquipment.mockRejectedValueOnce(
        new EquipmentEditError("ingredient-in-use")
      );

      await expect(caller.remove({ equipmentId: testId })).rejects.toThrow(
        expect.objectContaining({ code: "CONFLICT", message: "ingredient-in-use" })
      );
    });
  });

  describe("merge", () => {
    it("merges source equipment into target equipment", async () => {
      mockCatalogue.mergeEquipment.mockResolvedValueOnce(undefined);

      const result = await caller.merge({ sourceId: testId, targetId });

      expect(mockCatalogue.mergeEquipment).toHaveBeenCalledWith(
        expect.any(Object),
        testId,
        targetId
      );
      expect(result).toEqual({ success: true });
    });
  });
});
