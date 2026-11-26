// @vitest-environment node
/**
 * Which Ingredient Icon a food shows, against a real database: its own,
 * else the one shipped for its Open Food Facts entry, else its nearest
 * Parent Ingredient's, else none. A small fixture set stands in for the
 * shipped one. Setting and removing an own icon go through the panel's
 * draft, and a merge loses no icon.
 */
import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import type { IconSet } from "@norish/shared-server/ingredients/icons";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { withTransaction } from "@norish/db/drizzle";
import { deleteCatalogueIngredient } from "@norish/db/repositories/ingredient-catalogue";
import { listIconCatalogue, setIngredientIcon } from "@norish/db/repositories/ingredient-icons";
import { lockTree } from "@norish/db/repositories/ingredient-relocation";
import { insertSeededIngredient } from "@norish/db/repositories/ingredient-seed";
import {
  CatalogueEditError,
  mergeIngredients,
  saveDraft,
  setParent,
} from "@norish/shared-server/ingredients/catalogue";
import {
  deleteUnusedIngredientIcons,
  DRAFT_ICON_GRACE_MS,
  sweepIngredientIcons,
} from "@norish/shared-server/ingredients/icon-drafts";
import {
  drawNewIngredientIcon,
  listFoodsShowingNoIcon,
} from "@norish/shared-server/ingredients/icon-rounds";
import { ingredientIcons } from "@norish/shared-server/ingredients/icons";
import { resolveIngredients } from "@norish/shared-server/ingredients/resolver";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import { testHouseholdOf } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

// The image provider, drawing a plain square: the cut-out and the store are real.
const drawer = vi.hoisted(() => ({ drawIngredientIcon: vi.fn() }));

vi.mock("@norish/shared-server/ai/enrichment/ingredient-icon-drawer", () => drawer);

const SHIPPED_ONION = "0123456789abcdef0123456789abcdef.webp";
const SHIPPED_PEPPER = "fedcba9876543210fedcba9876543210.webp";
const OWN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp";
const OTHER_OWN = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp";

const SET: IconSet = {
  icons: { "en:onion": SHIPPED_ONION, "en:pepper": SHIPPED_PEPPER },
  none: ["en:vegetables"],
};

const address = (file: string) => `/ingredient-icons/${file}`;

describe("Ingredient Icons", () => {
  const testBase = new RepositoryTestBase("test_ingredient_icons");
  const uploadsDir = mkdtempSync(path.join(os.tmpdir(), "ingredient-icons-test-"));
  const originalUploadsDir = SERVER_CONFIG.UPLOADS_DIR;

  let actor: CatalogueActor;

  beforeAll(async () => {
    await testBase.setup();
    SERVER_CONFIG.UPLOADS_DIR = uploadsDir;
    // Two own icons, as an upload would have stored them.
    await fs.mkdir(path.join(uploadsDir, "ingredient-icons"), { recursive: true });
    for (const file of [OWN, OTHER_OWN]) {
      await fs.writeFile(path.join(uploadsDir, "ingredient-icons", file), "icon");
    }
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    // An administrator, so a seeded food's icon and parent are theirs to set.
    actor = {
      userId: user.id,
      householdId: testHouseholdOf(user.id),
      isServerAdmin: true,
    };
  });

  afterAll(async () => {
    SERVER_CONFIG.UPLOADS_DIR = originalUploadsDir;
    await testBase.teardown();
  });

  /** A household's food, or with an Open Food Facts id a seeded one, with its own icon where given. */
  async function food(name: string, values: { offId?: string; icon?: string } = {}) {
    const id = values.offId
      ? await insertSeededIngredient({ name, offId: values.offId }, [
          { text: name, fold: ingredientAliasFold(name), locale: "en" },
        ])
      : (await resolveIngredients([name], actor))[0]!.ingredientId;
    const { icon } = values;

    if (icon !== undefined) await withTransaction((tx) => setIngredientIcon(tx, id, icon));

    return id;
  }

  async function shown(id: string) {
    return (await ingredientIcons([id], SET)).get(id)?.address ?? null;
  }

  it("sweeps an erased household's icon files at once, keeping one another food still shows", async () => {
    const gone = "dddddddddddddddddddddddddddddddd.webp";
    const shared = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.webp";

    for (const file of [gone, shared]) {
      await fs.writeFile(path.join(uploadsDir, "ingredient-icons", file), "icon");
    }
    // Another household's copy of the food shows the same file.
    await food("kipfilet", { icon: shared });

    await expect(deleteUnusedIngredientIcons([gone, shared])).resolves.toBe(1);
    await expect(fs.readdir(path.join(uploadsDir, "ingredient-icons"))).resolves.toEqual(
      expect.arrayContaining([shared])
    );
    await expect(fs.readdir(path.join(uploadsDir, "ingredient-icons"))).resolves.not.toContain(
      gone
    );
  });

  it("shows nothing for a food with no icon anywhere in its lineage", async () => {
    const kohlrabi = await food("kohlrabi");

    await expect(ingredientIcons([kohlrabi], SET)).resolves.toEqual(
      new Map([[kohlrabi, { address: null, own: false }]])
    );
  });

  it("shows the icon Norish ships for the food's Open Food Facts entry", async () => {
    const onion = await food("onion", { offId: "en:onion" });

    expect(await shown(onion)).toBe(address(SHIPPED_ONION));
  });

  it("shows a food's own icon over the shipped one", async () => {
    const onion = await food("onion", { offId: "en:onion", icon: OWN });

    await expect(ingredientIcons([onion], SET)).resolves.toEqual(
      new Map([[onion, { address: address(OWN), own: true }]])
    );
  });

  it("borrows the nearest ancestor's own or shipped icon", async () => {
    const allium = await food("allium", { offId: "en:allium", icon: OTHER_OWN });
    const onion = await food("onion", { offId: "en:onion" });
    const red = await food("red onion");
    const pearl = await food("pearl onion");

    await setParent(actor, onion, allium);
    await setParent(actor, red, onion);
    await setParent(actor, pearl, red);

    // A red onion shows the onion's, not the allium's, and so does a kind of red onion.
    expect(await shown(red)).toBe(address(SHIPPED_ONION));
    expect(await shown(pearl)).toBe(address(SHIPPED_ONION));
    expect((await ingredientIcons([red], SET)).get(red)?.own).toBe(false);

    await withTransaction((tx) => setIngredientIcon(tx, red, OWN));
    expect(await shown(pearl)).toBe(address(OWN));
  });

  it("gives a vague group no icon of its own, while borrowing passes it by", async () => {
    const vegetables = await food("vegetables", { offId: "en:vegetables" });
    const kohlrabi = await food("kohlrabi");

    await setParent(actor, kohlrabi, vegetables);

    // At the top of the tree, the group shows nothing, and nor does what borrows from it.
    expect(await shown(vegetables)).toBeNull();
    expect(await shown(kohlrabi)).toBeNull();

    // Filed under a food with an icon, the group is passed by on the way up.
    const produce = await food("produce", { offId: "en:produce", icon: OTHER_OWN });

    await setParent(actor, vegetables, produce);
    expect(await shown(kohlrabi)).toBe(address(OTHER_OWN));
  });

  it("sets an own icon from the panel's draft, and removing it brings the shipped one back", async () => {
    const onion = await food("onion", { offId: "en:onion" });

    await saveDraft(actor, onion, { add: [], remove: [], icon: OWN });
    expect(await shown(onion)).toBe(address(OWN));

    await saveDraft(actor, onion, { add: [], remove: [], icon: null });
    expect(await shown(onion)).toBe(address(SHIPPED_ONION));
  });

  it("refuses a draft icon no upload stored, and changes nothing", async () => {
    const onion = await food("onion");
    const save = saveDraft(actor, onion, {
      name: "Onion",
      add: [],
      remove: [],
      icon: "cccccccccccccccccccccccccccccccc.webp",
    });

    await expect(save).rejects.toBeInstanceOf(CatalogueEditError);
    expect((await listIconCatalogue()).get(onion)).toMatchObject({ name: "onion", icon: null });
  });

  it("keeps the surviving food's own icon in a merge", async () => {
    const ui = await food("ui", { icon: OTHER_OWN });
    const onion = await food("onion", { icon: OWN });

    await mergeIngredients(actor, ui, onion);

    expect(await shown(onion)).toBe(address(OWN));
  });

  it("takes the merged-away food's own icon where the household's survivor has none", async () => {
    const ui = await food("ui", { icon: OTHER_OWN });
    const onion = await food("onion");

    await mergeIngredients(actor, ui, onion);

    await expect(ingredientIcons([onion], SET)).resolves.toEqual(
      new Map([[onion, { address: address(OTHER_OWN), own: true }]])
    );
  });

  it("gives a seeded survivor no icon of a household's: every household reads it", async () => {
    const ui = await food("ui", { icon: OTHER_OWN });
    const onion = await food("onion", { offId: "en:onion" });
    const before = await shown(onion);

    await mergeIngredients(actor, ui, onion);

    await expect(shown(onion)).resolves.toBe(before);
  });

  it("sweeps the icon files no food points at, past a draft's grace", async () => {
    const dir = path.join(uploadsDir, "ingredient-icons");
    const stale = "dddddddddddddddddddddddddddddddd.webp";
    const fresh = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.webp";
    const now = Date.now();
    const old = new Date(now - DRAFT_ICON_GRACE_MS - 60_000);

    await food("onion", { icon: OWN });
    for (const file of [stale, fresh]) await fs.writeFile(path.join(dir, file), "icon");
    // An icon a food uses and a draft nobody saved, both past the grace; a draft still open.
    await fs.utimes(path.join(dir, OWN), old, old);
    await fs.utimes(path.join(dir, stale), old, old);

    await expect(sweepIngredientIcons(now)).resolves.toEqual({ deleted: 1, errors: 0 });
    // The other own icon nothing points at is as recent as an open draft's.
    expect((await fs.readdir(dir)).sort()).toEqual([OWN, OTHER_OWN, fresh].sort());
  });

  it("lists and draws a food AI left an icon only where it would show none at all", async () => {
    // A food on a flat background, as the provider draws one.
    const square = await sharp(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#fff"/><circle cx="128" cy="128" r="80" fill="#a0c040"/></svg>'
      )
    )
      .png()
      .toBuffer();

    drawer.drawIngredientIcon.mockReset().mockResolvedValue({ bytes: square });
    const kohlrabi = await food("kohlrabi");
    const onion = await food("onion", { offId: "en:onion" });
    const red = await food("red onion");

    await setParent(actor, red, onion);

    // A red onion keeps showing the onion, and a food merged away is gone: neither is listed.
    const merged = await food("romanesco");

    await withTransaction(async (tx) => {
      await lockTree(tx);
      await deleteCatalogueIngredient(tx, merged);
    });
    // A vague group stays without one on purpose.
    const vegetables = await food("vegetables", { offId: "en:vegetables" });

    await expect(
      listFoodsShowingNoIcon([red, kohlrabi, onion, merged, vegetables], SET)
    ).resolves.toEqual([{ id: kohlrabi, name: "kohlrabi" }]);
    await expect(drawNewIngredientIcon(red, SET)).resolves.toEqual({
      outcome: "skipped",
      reason: "has-icon",
    });
    expect(drawer.drawIngredientIcon).not.toHaveBeenCalled();

    await expect(drawNewIngredientIcon(kohlrabi, SET)).resolves.toEqual({ outcome: "drawn" });
    expect(drawer.drawIngredientIcon).toHaveBeenCalledWith({ name: "kohlrabi", kindOf: [] });
    await expect(ingredientIcons([kohlrabi], SET)).resolves.toEqual(
      new Map([
        [
          kohlrabi,
          { address: expect.stringMatching(/^\/ingredient-icons\/[0-9a-f]{32}\.webp$/), own: true },
        ],
      ])
    );
  });
});
