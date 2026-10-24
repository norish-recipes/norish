import type { PermissionLevel } from "@norish/config/zod/server-config";
import type { DbTransaction } from "@norish/db/drizzle";
import type {
  CatalogueEquipment,
  CatalogueEquipmentAlias,
} from "@norish/db/repositories/equipment";
import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import type {
  EquipmentListItemDto,
  EquipmentSpellingDto,
} from "@norish/shared/contracts/dto/equipment";
import type { EquipmentCatalogueRefusal } from "@norish/shared/contracts/zod/equipment";
import type {
  IngredientSearchField,
  IngredientSearchMatch,
} from "@norish/shared/lib/ingredient-search";
import { withTransaction } from "@norish/db/drizzle";
import { isConstraintViolation } from "@norish/db/repositories/constraint-violation";
import {
  cleanEquipmentText,
  countEquipmentAliasesOf,
  deleteCatalogueEquipment,
  deleteCatalogueEquipmentAlias,
  findCatalogueEquipmentAliasOwner,
  findCatalogueEquipmentOwner,
  findEquipmentIdByFold,
  insertCatalogueEquipment,
  insertCatalogueEquipmentAlias,
  isEquipmentAliasInUse,
  isEquipmentInUse,
  listCatalogueEquipment,
  mergeCatalogueEquipment,
  renameCatalogueEquipment,
  setCatalogueEquipmentIcon,
} from "@norish/db/repositories/equipment";
import { getIngredientPermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { foldName } from "@norish/shared/lib/fold-name";
import { viewerAndHouseholdIds } from "@norish/shared/lib/household";
import { parseIngredientSearch } from "@norish/shared/lib/ingredient-search";

import {
  claimOwnEquipmentIcon,
  resolveEquipmentIcon,
  shippedEquipmentIconSet,
  storeEquipmentIcon,
} from "./icons";

export class EquipmentEditError extends Error {
  constructor(readonly refusal: EquipmentCatalogueRefusal) {
    super(refusal);
  }
}

export const EQUIPMENT_PAGE_SIZE = 50;

export function mayEditEquipmentRow(
  level: PermissionLevel,
  actor: CatalogueActor,
  ownerId: string | null
): boolean {
  if (actor.isServerAdmin) return true;
  if (ownerId === actor.userId) return true;

  switch (level) {
    case "everyone":
      return true;
    case "household":
      return ownerId === null || viewerAndHouseholdIds(actor).includes(ownerId);
    default:
      return false;
  }
}

function toSpelling(
  alias: CatalogueEquipmentAlias,
  may: (ownerId: string | null) => boolean
): EquipmentSpellingDto {
  return {
    id: alias.id,
    text: alias.text,
    seeded: alias.seeded,
    canRemove: may(alias.ownerId),
    inUse: alias.inUse,
  };
}

function toListItem(
  row: CatalogueEquipment,
  may: (ownerId: string | null) => boolean,
  iconSet = shippedEquipmentIconSet()
): EquipmentListItemDto {
  const resolved = resolveEquipmentIcon(row.id, row.icon, iconSet);

  return {
    id: row.id,
    name: row.name,
    icon: resolved.address,
    ownIcon: resolved.own,
    canEdit: may(row.ownerId),
    aliases: row.aliases.map((alias) => toSpelling(alias, may)),
  };
}

export async function listEquipment(
  actor: CatalogueActor,
  query: {
    search?: string;
    match?: IngredientSearchMatch;
    fields?: IngredientSearchField[];
    id?: string;
    offset?: number;
  }
): Promise<{ items: EquipmentListItemDto[]; nextOffset: number | null }> {
  const search = query.search?.trim() ?? "";
  const offset = query.offset ?? 0;
  const [policy, rows] = await Promise.all([
    getIngredientPermissionPolicy(),
    listCatalogueEquipment({
      search: parseIngredientSearch(search, { match: query.match, fields: query.fields }),
      id: query.id,
      limit: EQUIPMENT_PAGE_SIZE + 1,
      offset,
    }),
  ]);
  const may = (ownerId: string | null) => mayEditEquipmentRow(policy.edit, actor, ownerId);
  const page = rows.slice(0, EQUIPMENT_PAGE_SIZE);

  return {
    items: page.map((row) => toListItem(row, may)),
    nextOffset: rows.length > EQUIPMENT_PAGE_SIZE ? offset + EQUIPMENT_PAGE_SIZE : null,
  };
}

async function refusedOn<T>(
  code: "23505" | "23503",
  refusal: EquipmentCatalogueRefusal,
  write: () => Promise<T>
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isConstraintViolation(error, code)) throw new EquipmentEditError(refusal);
    throw error;
  }
}

async function assertMayEditEquipment(
  tx: DbTransaction,
  actor: CatalogueActor,
  equipmentId: string
): Promise<void> {
  const row = await findCatalogueEquipmentOwner(tx, equipmentId);

  if (!row) throw new EquipmentEditError("not-found");
  const policy = await getIngredientPermissionPolicy();

  if (!mayEditEquipmentRow(policy.edit, actor, row.ownerId)) {
    throw new EquipmentEditError("forbidden");
  }
}

export async function createEquipment(
  actor: CatalogueActor,
  input: {
    name: string;
    aliases?: readonly string[];
    icon?: string | null;
  }
): Promise<{ equipmentId: string }> {
  const cleaned = cleanEquipmentText(input.name);
  const nameFold = foldName(cleaned);

  if (!cleaned || !nameFold) throw new EquipmentEditError("empty");

  return await withTransaction(async (tx) => {
    if (await findEquipmentIdByFold(tx, nameFold)) {
      throw new EquipmentEditError("name-taken");
    }

    let icon: string | null = null;

    if (input.icon) {
      if (!(await claimOwnEquipmentIcon(input.icon))) throw new EquipmentEditError("not-found");
      icon = input.icon;
    }

    const created = await refusedOn("23505", "name-taken", () =>
      insertCatalogueEquipment(tx, {
        name: cleaned,
        ownerId: actor.userId,
        icon,
      })
    );

    await insertCatalogueEquipmentAlias(tx, {
      equipmentId: created.id,
      text: cleaned,
      fold: nameFold,
      ownerId: actor.userId,
      seeded: false,
    });

    for (const raw of input.aliases ?? []) {
      const aliasText = cleanEquipmentText(raw);
      const aliasFold = foldName(aliasText);

      if (!aliasText || !aliasFold || aliasFold === nameFold) continue;

      const inserted = await insertCatalogueEquipmentAlias(tx, {
        equipmentId: created.id,
        text: aliasText,
        fold: aliasFold,
        ownerId: actor.userId,
        seeded: false,
      });

      if (!inserted && (await findEquipmentIdByFold(tx, aliasFold)) !== created.id) {
        throw new EquipmentEditError("spelling-taken");
      }
    }

    return { equipmentId: created.id };
  });
}

async function addEquipmentAliasIn(
  tx: DbTransaction,
  actor: CatalogueActor,
  equipmentId: string,
  text: string
): Promise<void> {
  const cleaned = cleanEquipmentText(text);
  const fold = foldName(cleaned);

  if (!cleaned || !fold) throw new EquipmentEditError("empty");
  if (!(await findCatalogueEquipmentOwner(tx, equipmentId))) {
    throw new EquipmentEditError("not-found");
  }

  const alias = await insertCatalogueEquipmentAlias(tx, {
    equipmentId,
    text: cleaned,
    fold,
    ownerId: actor.userId,
  });

  if (!alias && (await findEquipmentIdByFold(tx, fold)) !== equipmentId) {
    throw new EquipmentEditError("spelling-taken");
  }
}

async function renameEquipmentIn(
  tx: DbTransaction,
  actor: CatalogueActor,
  equipmentId: string,
  name: string
): Promise<void> {
  const cleaned = cleanEquipmentText(name);
  const fold = foldName(cleaned);

  if (!cleaned || !fold) throw new EquipmentEditError("empty");
  await assertMayEditEquipment(tx, actor, equipmentId);

  const renamed = await refusedOn("23505", "name-taken", () =>
    renameCatalogueEquipment(tx, equipmentId, cleaned)
  );

  if (!renamed) throw new EquipmentEditError("not-found");

  await insertCatalogueEquipmentAlias(tx, {
    equipmentId,
    text: cleaned,
    fold,
    ownerId: actor.userId,
  });
}

async function removeEquipmentAliasIn(
  tx: DbTransaction,
  actor: CatalogueActor,
  aliasId: string,
  of?: string
): Promise<void> {
  const alias = await findCatalogueEquipmentAliasOwner(tx, aliasId);

  if (!alias) throw new EquipmentEditError("not-found");
  const policy = await getIngredientPermissionPolicy();

  if (!mayEditEquipmentRow(policy.edit, actor, alias.ownerId)) {
    throw new EquipmentEditError("forbidden");
  }
  if (of !== undefined && alias.equipmentId !== of) throw new EquipmentEditError("not-found");
  if ((await countEquipmentAliasesOf(tx, alias.equipmentId)) <= 1) {
    throw new EquipmentEditError("last-alias");
  }
  if (await isEquipmentAliasInUse(tx, aliasId)) throw new EquipmentEditError("alias-in-use");

  await refusedOn("23503", "alias-in-use", () => deleteCatalogueEquipmentAlias(tx, aliasId));
}

async function setEquipmentIconIn(
  tx: DbTransaction,
  actor: CatalogueActor,
  equipmentId: string,
  icon: string | null
): Promise<void> {
  await assertMayEditEquipment(tx, actor, equipmentId);
  if (icon !== null && !(await claimOwnEquipmentIcon(icon))) {
    throw new EquipmentEditError("not-found");
  }
  if (!(await setCatalogueEquipmentIcon(tx, equipmentId, icon))) {
    throw new EquipmentEditError("not-found");
  }
}

export interface EquipmentDraft {
  name?: string;
  add: readonly string[];
  remove: readonly string[];
  icon?: string | null;
}

export async function saveEquipmentDraft(
  actor: CatalogueActor,
  equipmentId: string,
  draft: EquipmentDraft
): Promise<void> {
  await withTransaction(async (tx) => {
    if (draft.name !== undefined) {
      await renameEquipmentIn(tx, actor, equipmentId, draft.name);
    }
    for (const aliasId of draft.remove) {
      await removeEquipmentAliasIn(tx, actor, aliasId, equipmentId);
    }
    for (const text of draft.add) {
      await addEquipmentAliasIn(tx, actor, equipmentId, text);
    }
    if (draft.icon !== undefined) {
      await setEquipmentIconIn(tx, actor, equipmentId, draft.icon);
    }
  });
}

export async function deleteEquipment(actor: CatalogueActor, equipmentId: string): Promise<void> {
  await withTransaction(async (tx) => {
    await assertMayEditEquipment(tx, actor, equipmentId);
    if (await isEquipmentInUse(tx, equipmentId)) {
      throw new EquipmentEditError("ingredient-in-use");
    }
    await refusedOn("23503", "ingredient-in-use", () => deleteCatalogueEquipment(tx, equipmentId));
  });
}

export async function mergeEquipment(
  actor: CatalogueActor,
  sourceId: string,
  targetId: string
): Promise<void> {
  if (sourceId === targetId) throw new EquipmentEditError("same-ingredient");

  await withTransaction(async (tx) => {
    await assertMayEditEquipment(tx, actor, sourceId);
    await assertMayEditEquipment(tx, actor, targetId);
    if (!(await mergeCatalogueEquipment(tx, sourceId, targetId))) {
      throw new EquipmentEditError("not-found");
    }
  });
}

export async function uploadEquipmentIcon(
  actor: CatalogueActor,
  equipmentId: string | null,
  picture: Buffer
): Promise<{ file: string; address: string }> {
  if (equipmentId) {
    await withTransaction((tx) => assertMayEditEquipment(tx, actor, equipmentId));
  }

  return storeEquipmentIcon(picture);
}
