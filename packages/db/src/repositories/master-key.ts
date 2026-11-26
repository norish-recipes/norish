import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  getTableName,
  gt,
  isNotNull,
  isNull,
  ne,
} from "drizzle-orm";

import type { MasterKeyRotation, SealedBy } from "@norish/config/crypto";
import type { DbTransaction } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";

import { sessions, users, verification } from "../schema/auth";
import { userCaldavConfig } from "../schema/caldav-config";
import { recipeShares } from "../schema/recipe-shares";
import { serverConfig } from "../schema/server-config";
import { siteAuthTokens } from "../schema/site-auth-tokens";
import { ServerConfigKeys } from "../zodSchemas/server-config";
import { keptNoLink } from "./recipe-share-helpers";
import { getConfig } from "./server-config";

const secretSetting = isNotNull(serverConfig.valueEnc);
const fingerprintRow = eq(serverConfig.key, ServerConfigKeys.MASTER_KEY_FINGERPRINT);

/** What counts as a stored fingerprint: a non-empty string. JSON null, "" and the rest are none. */
const storedFingerprint = (value: unknown) =>
  typeof value === "string" && value !== "" ? value : null;

/** Rows that hold encrypted data: every account and every secret setting; the rest belong to an account. */
export async function countEncryptedRows(): Promise<number> {
  const [accounts, secrets] = await Promise.all([
    db.$count(users),
    db.$count(serverConfig, secretSetting),
  ]);

  return accounts + secrets;
}

/** What to try a key on: the newest account's email, else the newest secret setting, never empty. */
export async function findNewestCiphertext(): Promise<string | null> {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(ne(users.email, ""))
    .orderBy(desc(users.createdAt))
    .limit(1);

  if (user) return user.email;

  const [setting] = await db
    .select({ valueEnc: serverConfig.valueEnc })
    .from(serverConfig)
    .where(and(secretSetting, ne(serverConfig.valueEnc, "")))
    .orderBy(desc(serverConfig.updatedAt))
    .limit(1);

  return setting?.valueEnc ?? null;
}

/** The stored fingerprint of the current Master Key, or null when the database holds none. */
export async function getMasterKeyFingerprint(): Promise<string | null> {
  return storedFingerprint(await getConfig(ServerConfigKeys.MASTER_KEY_FINGERPRINT));
}

/** Store `fingerprint` unless a fingerprint is there already; the one the database holds after. */
export async function claimMasterKeyFingerprint(fingerprint: string): Promise<string> {
  return await db.transaction(async (tx) => {
    await tx
      .insert(serverConfig)
      .values({ key: ServerConfigKeys.MASTER_KEY_FINGERPRINT, value: fingerprint })
      .onConflictDoNothing({ target: serverConfig.key });
    // The row lock makes a second claimer wait, then read what the first one stored.
    const [row] = await tx
      .select({ value: serverConfig.value })
      .from(serverConfig)
      .where(fingerprintRow)
      .for("update");
    const stored = storedFingerprint(row?.value);

    if (stored) return stored;
    await tx
      .update(serverConfig)
      .set({ value: fingerprint, updatedAt: new Date() })
      .where(fingerprintRow);

    return fingerprint;
  });
}

/** A table's encrypted columns, the lookup hash one is the source of, if any were once plain. */
type Sealing = {
  table: PgTable;
  key: PgColumn;
  sealed: PgColumn[];
  lookup?: { hash: PgColumn; of: PgColumn };
  legacyPlaintext?: true;
};

/** Every value in Postgres the Master Key encrypts or hashes; the re-key reads only this. */
export const MASTER_KEY_COLUMNS: Sealing[] = [
  {
    table: users,
    key: users.id,
    sealed: [users.email, users.name, users.image],
    lookup: { hash: users.emailHmac, of: users.email },
    // The only columns the old tolerant read accepted in plain text.
    legacyPlaintext: true,
  },
  {
    table: userCaldavConfig,
    key: userCaldavConfig.userId,
    sealed: [
      userCaldavConfig.serverUrlEnc,
      userCaldavConfig.calendarUrlEnc,
      userCaldavConfig.usernameEnc,
      userCaldavConfig.passwordEnc,
      userCaldavConfig.trustedCertificateEnc,
    ],
  },
  { table: siteAuthTokens, key: siteAuthTokens.id, sealed: [siteAuthTokens.valueEnc] },
  { table: serverConfig, key: serverConfig.id, sealed: [serverConfig.valueEnc] },
  {
    table: recipeShares,
    key: recipeShares.id,
    sealed: [recipeShares.tokenEnc],
    lookup: { hash: recipeShares.tokenHash, of: recipeShares.tokenEnc },
  },
];

/** Rows read at a time, so no table is held in memory whole. */
const PAGE_SIZE = 500;

/**
 * Visit every row `readPage` reads, `limit` rows at a time in key order: each page holds the rows
 * `after` the last one of the page before, which `pastRow` names; the first page has no `after`.
 */
async function forEachRow<Row>(
  readPage: (after: SQL | undefined, limit: number) => Promise<Row[]>,
  pastRow: (row: Row) => SQL,
  visit: (row: Row) => Promise<void>
): Promise<void> {
  let after: SQL | undefined;

  for (;;) {
    const rows = await readPage(after, PAGE_SIZE);
    const lastRow = rows.at(-1);

    for (const row of rows) await visit(row);
    if (!lastRow || rows.length < PAGE_SIZE) return;
    after = pastRow(lastRow);
  }
}

/** Per `table.column`, how many values each key had sealed. */
export type ResealCounts = Record<string, Record<SealedBy, number>>;

/** The property a column is under in its table, as `select` and `set` name it. */
function propertyOf(table: PgTable, column: PgColumn): string {
  const found = Object.entries(getTableColumns(table)).find(
    ([, candidate]) => candidate === column
  );

  if (!found) throw new Error(`${column.name} is not a column of ${getTableName(table)}`);

  return found[0];
}

async function resealTable(
  tx: DbTransaction,
  rotation: MasterKeyRotation,
  { table, key, sealed, lookup, legacyPlaintext }: Sealing,
  counts: ResealCounts
): Promise<void> {
  const keyProperty = propertyOf(table, key);
  const hashProperty = lookup && propertyOf(table, lookup.hash);
  const columns = sealed.map((column) => ({
    column,
    property: propertyOf(table, column),
    tally: (counts[`${getTableName(table)}.${column.name}`] = {
      previous: 0,
      current: 0,
      plaintext: 0,
      unreadable: 0,
    }),
  }));
  const fields = Object.fromEntries([
    [keyProperty, key],
    ...columns.map(({ column, property }) => [property, column]),
    ...(lookup && hashProperty ? [[hashProperty, lookup.hash]] : []),
  ]);

  await forEachRow(
    (after, limit) => tx.select(fields).from(table).where(after).orderBy(asc(key)).limit(limit),
    (lastRow) => gt(key, lastRow[keyProperty]),
    async (row) => {
      const update: Record<string, string> = {};
      let lookupSource: string | null = null;

      for (const { column, property, tally } of columns) {
        const value = row[property];

        // Nothing is stored empty encrypted, so an empty value has nothing to move.
        if (typeof value !== "string" || value === "") continue;

        const { sealed: moved, plain, was } = rotation.reseal(value, { legacyPlaintext });

        tally[was] += 1;
        if (moved !== value) update[property] = moved;
        if (column === lookup?.of) lookupSource = plain;
      }
      // A lookup hash is recomputed from a value that opened; a missing one stays missing.
      if (hashProperty && lookupSource !== null && row[hashProperty]) {
        update[hashProperty] = rotation.lookup(lookupSource);
      }
      if (Object.keys(update).length > 0) {
        await tx.update(table).set(update).where(eq(key, row[keyProperty]));
      }
    }
  );
}

/** End the share links that kept no token, as no hash under a new key can be made for them. */
async function revokeSharesWithoutToken(tx: DbTransaction): Promise<number> {
  const now = new Date();
  let revoked = 0;

  await forEachRow(
    (after, limit) =>
      tx
        .select({ id: recipeShares.id, version: recipeShares.version })
        .from(recipeShares)
        .where(and(keptNoLink, isNull(recipeShares.revokedAt), after))
        .orderBy(asc(recipeShares.id))
        .limit(limit),
    (lastRow) => gt(recipeShares.id, lastRow.id),
    async ({ id, version }) => {
      await tx
        .update(recipeShares)
        .set({ revokedAt: now, updatedAt: now, version: version + 1 })
        .where(eq(recipeShares.id, id));
      revoked += 1;
    }
  );

  return revoked;
}

/**
 * Move everything the Master Key with fingerprint `from` sealed under `rotation`'s current key,
 * end every session, and name the current key `to`: in one transaction, or not at all.
 */
export async function rekeyMasterKey(
  rotation: MasterKeyRotation,
  fingerprints: { from: string; to: string }
): Promise<{
  columns: ResealCounts;
  revokedShares: number;
  ended: { sessions: number; verifications: number };
}> {
  return await db.transaction(async (tx) => {
    // The row lock keeps a second re-key out until this one commits or rolls back.
    const [row] = await tx
      .select({ value: serverConfig.value })
      .from(serverConfig)
      .where(fingerprintRow)
      .for("update");

    if (storedFingerprint(row?.value) !== fingerprints.from) {
      throw new Error("The Master Key fingerprint changed before the re-key could start");
    }

    const revokedShares = await revokeSharesWithoutToken(tx);
    const columns: ResealCounts = {};

    for (const sealing of MASTER_KEY_COLUMNS) await resealTable(tx, rotation, sealing, columns);
    const ended = {
      sessions: (await tx.delete(sessions)).rowCount ?? 0,
      verifications: (await tx.delete(verification)).rowCount ?? 0,
    };

    await tx
      .update(serverConfig)
      .set({ value: fingerprints.to, updatedAt: new Date() })
      .where(fingerprintRow);

    return { columns, revokedShares, ended };
  });
}
