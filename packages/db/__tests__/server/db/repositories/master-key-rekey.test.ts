// @vitest-environment node

import { randomBytes } from "node:crypto";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getTableColumns, getTableName, is, isNull } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { MasterKeyRotation } from "@norish/config/crypto";
import {
  decrypt,
  encrypt,
  initMasterKey,
  masterKeyFingerprint,
  masterKeyOpens,
  masterKeyRotation,
} from "@norish/config/crypto";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import * as everyTable from "@norish/db-schema";
import { getCaldavConfigDecrypted, saveCaldavConfig } from "@norish/db/repositories/caldav-config";
import {
  getMasterKeyFingerprint,
  MASTER_KEY_COLUMNS,
  rekeyMasterKey,
} from "@norish/db/repositories/master-key";
import { createRecipeShare, getRecipeShareByToken } from "@norish/db/repositories/recipe-shares";
import { getConfig, setConfig } from "@norish/db/repositories/server-config";
import {
  createSiteAuthToken,
  getDecryptedTokensByUserId,
} from "@norish/db/repositories/site-auth-tokens";
import { createUser, getUserByEmail } from "@norish/db/repositories/users";
import * as schema from "@norish/db/schema";

import { forgetMasterKey } from "../../../../../config/__tests__/helpers/master-key";
import {
  cleanDatabase,
  createTestRecipe,
  createTestRecipeShare,
  getTestDb,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const previous = randomBytes(32);
const current = randomBytes(32);
const fingerprints = { from: masterKeyFingerprint(previous), to: masterKeyFingerprint(current) };

/** `plain` as `key` encrypts it. */
function sealedBy(key: Buffer, plain: string): string {
  initMasterKey(key);

  return encrypt(plain);
}

/** Every row of every table the re-key touches, as Postgres holds it. */
async function snapshot() {
  const db = getTestDb();
  const tables = [...MASTER_KEY_COLUMNS.map(({ table }) => table), schema.sessions];

  return await Promise.all([
    ...tables.map((table) => db.select().from(table)),
    db.select().from(schema.verification),
  ]);
}

/** `table.column`, as the re-key counts it. */
const columnName = (table: PgTable, column: PgColumn) => `${getTableName(table)}.${column.name}`;

/** Every value in a re-keyed column, per row, as `key` reads it: null and "" as they are. */
async function openedValues(key: Buffer) {
  const values: Record<string, unknown> = {};

  initMasterKey(key);
  for (const { table, key: rowKey, sealed } of MASTER_KEY_COLUMNS) {
    const fields = Object.fromEntries(sealed.map((column) => [columnName(table, column), column]));

    for (const { row, ...columns } of await getTestDb()
      .select({ ...fields, row: rowKey })
      .from(table)) {
      for (const [column, value] of Object.entries(columns)) {
        values[`${column} of ${String(row)}`] =
          typeof value === "string" && value !== "" ? decrypt(value) : value;
      }
    }
  }
  forgetMasterKey();

  return values;
}

/** Every value in a re-keyed column, with the column it is in. */
async function sealedValues() {
  const values: { column: string; value: unknown }[] = [];

  for (const { table, sealed } of MASTER_KEY_COLUMNS) {
    const fields = Object.fromEntries(sealed.map((column) => [columnName(table, column), column]));

    for (const row of await getTestDb().select(fields).from(table)) {
      values.push(...Object.entries(row).map(([column, value]) => ({ column, value })));
    }
  }

  return values.filter(({ value }) => value !== null && value !== "");
}

describe("re-keying to a new Master Key", () => {
  const testBase = new RepositoryTestBase("master_key_rekey");
  let userId: string;
  let shareToken: string;
  // Shares from before 0.28, which kept only the hash of their token: one active, one revoked.
  let tokenless: { active?: string; revoked?: string };

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await cleanDatabase();
    for (const table of [schema.serverConfig, schema.sessions, schema.verification]) {
      await getTestDb().delete(table);
    }
    initMasterKey(previous);
    userId = (
      await createUser({
        id: "ada",
        email: "ada@example.com",
        name: "Ada",
        image: "/avatars/ada.png",
        emailVerified: true,
      })
    ).id;
    await saveCaldavConfig(userId, {
      serverUrl: "https://dav.example.com/",
      calendarUrl: "https://dav.example.com/ada/meals/",
      username: "ada",
      password: "dav-password",
      trustedCertificate: "-----BEGIN CERTIFICATE-----",
      enabled: true,
      breakfastTime: "08:00-09:00",
      lunchTime: "12:00-13:00",
      dinnerTime: "18:00-19:00",
      snackTime: "15:00-15:30",
    });
    await createSiteAuthToken(userId, {
      domain: "example.com",
      name: "session",
      value: "site-cookie",
      type: "cookie",
    });
    await setConfig(
      ServerConfigKeys.IMAGE_GENERATION_CONFIG,
      { provider: "openai", model: "gpt-image-1", apiKey: "openai-key" },
      null,
      true
    );
    await setConfig(ServerConfigKeys.MASTER_KEY_FINGERPRINT, fingerprints.from, null, false);

    const recipe = await createTestRecipe(userId);

    shareToken = (
      await createRecipeShare(userId, { recipeId: recipe.id, expiresIn: "forever" })
    ).url.replace("/share/", "");
    tokenless = {
      active: (await createTestRecipeShare(userId, recipe.id, { token: "old-a" })).share?.id,
      revoked: (
        await createTestRecipeShare(userId, recipe.id, {
          token: "old-b",
          revokedAt: new Date("2026-01-01"),
        })
      ).share?.id,
    };
    await getTestDb()
      .insert(schema.sessions)
      .values({ userId, token: "session-token", expiresAt: new Date(Date.now() + 60_000) });
    await getTestDb()
      .insert(schema.verification)
      .values({ identifier: "state", value: "{}", expiresAt: new Date(Date.now() + 60_000) });
    await getTestDb()
      .insert(schema.apiKeys)
      .values({ referenceId: userId, key: "sha256-of-an-api-key", start: "nor_" });
    forgetMasterKey();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("moves every encrypted column, seeded here, to the new key alone, every value kept", async () => {
    const before = await openedValues(previous);
    const { columns: counts } = await rekeyMasterKey(
      masterKeyRotation(previous, current),
      fingerprints
    );

    // Each column was seeded, so the check below covers every one.
    for (const { table, sealed } of MASTER_KEY_COLUMNS) {
      for (const column of sealed) {
        expect(counts[columnName(table, column)]).toEqual({
          previous: 1,
          current: 0,
          plaintext: 0,
          unreadable: 0,
        });
      }
    }
    for (const { column, value } of await sealedValues()) {
      const opens = (key: Buffer) => typeof value === "string" && masterKeyOpens(key, value);

      expect({ column, current: opens(current), previous: opens(previous) }).toEqual({
        column,
        current: true,
        previous: false,
      });
    }
    // Per row and field, optional ones included: a re-key that cleared one would show here.
    expect(await openedValues(current)).toEqual(before);
    expect(await getMasterKeyFingerprint()).toBe(fingerprints.to);
  });

  it("finds the account by email and the share by its link under the new key", async () => {
    await rekeyMasterKey(masterKeyRotation(previous, current), fingerprints);
    initMasterKey(current);

    expect(await getUserByEmail("ada@example.com")).toMatchObject({ id: userId, name: "Ada" });
    expect(await getRecipeShareByToken(shareToken)).toMatchObject({ userId });
    expect(await getDecryptedTokensByUserId(userId)).toMatchObject([{ value: "site-cookie" }]);
    expect(await getCaldavConfigDecrypted(userId)).toMatchObject({ password: "dav-password" });
    expect(await getConfig(ServerConfigKeys.IMAGE_GENERATION_CONFIG, true)).toMatchObject({
      apiKey: "openai-key",
    });
  });

  it("ends every session and verification, and leaves API keys as they are", async () => {
    const apiKeys = await getTestDb().select().from(schema.apiKeys);

    await rekeyMasterKey(masterKeyRotation(previous, current), fingerprints);

    expect(await getTestDb().select().from(schema.sessions)).toEqual([]);
    expect(await getTestDb().select().from(schema.verification)).toEqual([]);
    expect(await getTestDb().select().from(schema.apiKeys)).toEqual(apiKeys);
  });

  it("revokes the share links that kept no token, and counts them", async () => {
    const shares = async () =>
      new Map((await getTestDb().select().from(schema.recipeShares)).map((row) => [row.id, row]));
    const before = await shares();

    const { revokedShares } = await rekeyMasterKey(
      masterKeyRotation(previous, current),
      fingerprints
    );
    const after = await shares();

    expect(revokedShares).toBe(1);
    expect(after.get(tokenless.active ?? "")).toMatchObject({
      revokedAt: expect.any(Date),
      version: (before.get(tokenless.active ?? "")?.version ?? 0) + 1,
    });
    expect(after.get(tokenless.revoked ?? "")).toEqual(before.get(tokenless.revoked ?? ""));
    initMasterKey(current);
    expect(await getRecipeShareByToken(shareToken)).toMatchObject({ revokedAt: null });
  });

  it("encrypts a value no key opens as legacy plain text, and counts it", async () => {
    await getTestDb().update(schema.users).set({ name: "Ada Lovelace" });

    const { columns: counts } = await rekeyMasterKey(
      masterKeyRotation(previous, current),
      fingerprints
    );

    initMasterKey(current);
    expect(counts["user.name"]).toEqual({ previous: 0, current: 0, plaintext: 1, unreadable: 0 });
    expect(await getUserByEmail("ada@example.com")).toMatchObject({ name: "Ada Lovelace" });
  });

  it("leaves ciphertext neither key opens as it is, its lookup hash too, and counts it", async () => {
    const [before] = await getTestDb().select().from(schema.users);
    const damaged = Buffer.from(before?.email ?? "", "base64");

    damaged[12] = (damaged[12] ?? 0) ^ 1;
    await getTestDb()
      .update(schema.users)
      .set({ email: damaged.toString("base64"), name: sealedBy(randomBytes(32), "Ada") });
    const [unreadable] = await getTestDb().select().from(schema.users);

    const { columns: counts } = await rekeyMasterKey(
      masterKeyRotation(previous, current),
      fingerprints
    );
    const [after] = await getTestDb().select().from(schema.users);

    for (const column of ["user.email", "user.name"]) {
      expect(counts[column]).toEqual({ previous: 0, current: 0, plaintext: 0, unreadable: 1 });
    }
    expect(after).toMatchObject({
      email: unreadable?.email,
      name: unreadable?.name,
      emailHmac: before?.emailHmac,
    });
  });

  it("leaves ciphertext stripped of its padding or cut short as it is, its lookup hash too", async () => {
    const [before] = await getTestDb().select().from(schema.users);
    const email = sealedBy(randomBytes(32), "ada@example.com").replace(/=+$/, "");
    const name = sealedBy(randomBytes(32), "Ada Lovelace").slice(0, -7);

    await getTestDb().update(schema.users).set({ email, name });

    const { columns: counts } = await rekeyMasterKey(
      masterKeyRotation(previous, current),
      fingerprints
    );

    for (const column of ["user.email", "user.name"]) {
      expect(counts[column]).toEqual({ previous: 0, current: 0, plaintext: 0, unreadable: 1 });
    }
    expect(await getTestDb().select().from(schema.users)).toMatchObject([
      { email, name, emailHmac: before?.emailHmac },
    ]);
  });

  it("leaves a value outside the user's columns that no key opens as it is, and counts it", async () => {
    await getTestDb().update(schema.siteAuthTokens).set({ valueEnc: "site-cookie" });

    const { columns: counts } = await rekeyMasterKey(
      masterKeyRotation(previous, current),
      fingerprints
    );

    expect(counts["site_auth_tokens.value_enc"]).toEqual({
      previous: 0,
      current: 0,
      plaintext: 0,
      unreadable: 1,
    });
    expect(await getTestDb().select().from(schema.siteAuthTokens)).toMatchObject([
      { valueEnc: "site-cookie" },
    ]);
  });

  it("encrypts an email stored in plain text, and finds the account by it after", async () => {
    const [before] = await getTestDb().select().from(schema.users);

    await getTestDb().update(schema.users).set({ email: "ada@example.com" });

    const { columns: counts } = await rekeyMasterKey(
      masterKeyRotation(previous, current),
      fingerprints
    );
    const [after] = await getTestDb().select().from(schema.users);

    expect(counts["user.email"]).toEqual({ previous: 0, current: 0, plaintext: 1, unreadable: 0 });
    expect(after?.emailHmac).not.toBe(before?.emailHmac);
    initMasterKey(current);
    expect(decrypt(after?.email ?? "")).toBe("ada@example.com");
    expect(await getUserByEmail("ada@example.com")).toMatchObject({ id: userId });
  });

  it("keeps a value the new key wrote already, and still moves its lookup hash", async () => {
    const email = sealedBy(current, "ada@example.com");

    await getTestDb().update(schema.users).set({ email });

    const { columns: counts } = await rekeyMasterKey(
      masterKeyRotation(previous, current),
      fingerprints
    );
    const [user] = await getTestDb().select().from(schema.users);

    expect(counts["user.email"]).toEqual({ previous: 0, current: 1, plaintext: 0, unreadable: 0 });
    expect(user?.email).toBe(email);
    initMasterKey(current);
    expect(await getUserByEmail("ada@example.com")).toMatchObject({ id: userId });
  });

  it("leaves empty values and a missing lookup hash as they are", async () => {
    await getTestDb().update(schema.users).set({ name: "", emailHmac: null });

    await rekeyMasterKey(masterKeyRotation(previous, current), fingerprints);

    expect(await getTestDb().select().from(schema.users)).toMatchObject([
      { name: "", emailHmac: null },
    ]);
  });

  it("moves a table larger than one page", async () => {
    initMasterKey(previous);
    await getTestDb()
      .insert(schema.siteAuthTokens)
      .values(
        Array.from({ length: 1_200 }, (_, index) => ({
          userId,
          domain: "example.com",
          name: `token-${index}`,
          valueEnc: encrypt(`value-${index}`),
          type: "header" as const,
        }))
      );

    const { columns: counts } = await rekeyMasterKey(
      masterKeyRotation(previous, current),
      fingerprints
    );

    expect(counts["site_auth_tokens.value_enc"]).toEqual({
      previous: 1_201,
      current: 0,
      plaintext: 0,
      unreadable: 0,
    });
    initMasterKey(current);
    expect(await getDecryptedTokensByUserId(userId)).toHaveLength(1_201);
  });

  it("revokes more token-less share links than fit on one page", async () => {
    const [share] = await getTestDb().select().from(schema.recipeShares).limit(1);

    await getTestDb()
      .insert(schema.recipeShares)
      .values(
        Array.from({ length: 1_100 }, (_, index) => ({
          userId,
          recipeId: share?.recipeId ?? "",
          tokenHash: `old-hash-${index}`,
        }))
      );

    const { revokedShares } = await rekeyMasterKey(
      masterKeyRotation(previous, current),
      fingerprints
    );
    const tokenless = await getTestDb()
      .select({ revokedAt: schema.recipeShares.revokedAt })
      .from(schema.recipeShares)
      .where(isNull(schema.recipeShares.tokenEnc));

    expect(revokedShares).toBe(1_101);
    expect(tokenless.filter(({ revokedAt }) => revokedAt === null)).toEqual([]);
  });

  it("changes nothing when it fails midway, and a retry with the same keys finishes", async () => {
    const before = await snapshot();
    const rotation = masterKeyRotation(previous, current);
    let resealed = 0;
    const failing: MasterKeyRotation = {
      ...rotation,
      reseal: (value, options) => {
        resealed += 1;
        if (resealed === 5) throw new Error("disk gone");

        return rotation.reseal(value, options);
      },
    };

    await expect(rekeyMasterKey(failing, fingerprints)).rejects.toThrow("disk gone");
    expect(await snapshot()).toEqual(before);
    expect(await getMasterKeyFingerprint()).toBe(fingerprints.from);

    await rekeyMasterKey(rotation, fingerprints);
    initMasterKey(current);
    expect(await getUserByEmail("ada@example.com")).toMatchObject({ id: userId });
  });

  it("refuses to start when the fingerprint is no longer the previous key's", async () => {
    await setConfig(ServerConfigKeys.MASTER_KEY_FINGERPRINT, fingerprints.to, null, false);
    const before = await snapshot();

    await expect(
      rekeyMasterKey(masterKeyRotation(previous, current), fingerprints)
    ).rejects.toThrow("fingerprint changed");
    expect(await snapshot()).toEqual(before);
  });
});

/**
 * Every text column in the schema that is neither re-keyed nor listed here fails the guard below, so
 * a new encrypted or hashed column cannot be missed by forgetting it. List one here only when no
 * Master Key wrote it.
 */
const PLAIN_COLUMNS: Record<string, string[]> = {
  account: [
    "id",
    "providerId",
    "accountId",
    "accessToken",
    "refreshToken",
    "idToken",
    "scope",
    "password",
  ],
  aisles: ["name"],
  // `key` is Better Auth's unkeyed SHA-256 of the API key.
  apikey: ["id", "configId", "name", "start", "prefix", "key", "permissions", "metadata"],
  api_logs: ["id", "procedure", "type", "success", "error_code", "error_message", "meta"],
  caldav_sync_status: ["event_title", "caldav_event_uid", "error_message"],
  categories: ["name", "name_fold"],
  cookbooks: ["title", "image"],
  cuisine_tag_migrations: ["tag_name"],
  cuisines: ["name", "name_fold"],
  groceries: ["name", "unit"],
  households: ["name", "join_code"],
  ingredient_ai_changes: ["kind", "undo"],
  ingredient_aliases: ["text", "fold", "locale"],
  ingredient_junk_pile: ["fold", "reason"],
  ingredient_nutrition_corrections: ["numbers_food", "extras", "piece_weight_food", "density_food"],
  ingredients: ["name", "flag_reason", "off_id", "nutrition_codes", "icon"],
  nutrition_foods: ["dataset", "code", "name", "extras", "ndb"],
  nutrition_rules: ["off_id", "kind", "food"],
  parked_name_keyed_links: ["kind", "link"],
  planned_items: ["title"],
  recipe_images: ["image"],
  recipe_ingredients: ["name", "unit"],
  recipe_nutrition_estimates: ["lines"],
  recipe_videos: ["video", "thumbnail"],
  recipes: [
    "name",
    "description",
    "url",
    "notes",
    "nutrition_extras",
    "origin_country",
    "origin_country_name",
    "origin_region",
    "provenance_note",
    "dish_color",
  ],
  recurring_groceries: ["name", "unit", "recurrence_rule"],
  // `value` holds the fingerprint, which the re-key moves itself.
  server_config: ["id", "key", "value"],
  // Sessions and verifications are deleted, not re-keyed.
  session: ["id", "token", "ipAddress", "userAgent"],
  site_auth_tokens: ["domain", "account", "name"],
  step_images: ["image"],
  steps: ["step"],
  store_product_links: ["suggestion"],
  store_products: ["name", "page_url", "currency", "size", "pack_unit", "deal_words"],
  stores: ["name", "color", "website", "search_address"],
  tags: ["name", "name_fold"],
  user_allergies: ["name"],
  user_caldav_config: ["breakfast_time", "lunch_time", "dinner_time", "snack_time"],
  user: ["id", "preferences"],
  verification: ["id", "identifier", "value"],
};

describe("what the re-key covers", () => {
  const STRINGS = ["PgText", "PgVarchar", "PgChar", "PgJson", "PgJsonb"];

  /** Every column a string can be stored in, but those holding another row's key or an enum. */
  function textColumns(): string[] {
    const found: string[] = [];

    for (const table of Object.values(everyTable)) {
      if (!is(table, PgTable)) continue;

      const references = new Set(
        getTableConfig(table).foreignKeys.flatMap((key) => key.reference().columns)
      );

      for (const column of Object.values(getTableColumns(table))) {
        if (!STRINGS.includes(column.columnType) || column.enumValues?.length) continue;
        if (!references.has(column)) found.push(columnName(table, column));
      }
    }

    return found;
  }

  const rekeyed = MASTER_KEY_COLUMNS.flatMap(({ table, sealed, lookup }) =>
    [...sealed, ...(lookup ? [lookup.hash] : [])].map((column) => columnName(table, column))
  );
  const plain = Object.entries(PLAIN_COLUMNS).flatMap(([table, columns]) =>
    columns.map((column) => `${table}.${column}`)
  );

  it("re-keys or lists as plain every text column in the schema", () => {
    const unclassified = textColumns().filter(
      (column) => !rekeyed.includes(column) && !plain.includes(column)
    );

    // A column here holds what encrypt, hmacIndex or hashToken wrote: add it to MASTER_KEY_COLUMNS.
    expect(unclassified).toEqual([]);
  });

  it("lists no column twice, and none that is gone", () => {
    const columns = textColumns();

    expect(plain.filter((column) => rekeyed.includes(column))).toEqual([]);
    expect([...rekeyed, ...plain].filter((column) => !columns.includes(column))).toEqual([]);
  });
});
