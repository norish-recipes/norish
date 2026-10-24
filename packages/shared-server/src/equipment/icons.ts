import { readFileSync, statSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { findEquipmentIcons } from "@norish/db/repositories/equipment";

import { resolveExistingWorkspacePath } from "../lib/workspace-paths";
import { ICON_FILE_PATTERN, iconFileName, makeIngredientIcon } from "../media/ingredient-icon";

export const EQUIPMENT_ICON_ROUTE = "/equipment-icons";

export interface EquipmentIconSet {
  /** Seeded Equipment ID -> the shipped icon's file (`<32-hex>.webp`). */
  icons: Readonly<Record<string, string>>;
}

const EquipmentIconSetSchema = z.object({
  icons: z.record(z.string(), z.string().regex(ICON_FILE_PATTERN)),
});

let shipped: { set: EquipmentIconSet; mtimeMs: number } | null = null;

export function equipmentIconSetDir(): string {
  return resolveExistingWorkspacePath(
    path.join("packages", "shared-server", "src", "equipment", "icon-set")
  );
}

export function shippedEquipmentIconsDir(): string {
  return path.join(equipmentIconSetDir(), "icons");
}

export function shippedEquipmentIconSet(): EquipmentIconSet {
  try {
    const manifest = path.join(equipmentIconSetDir(), "manifest.json");
    const { mtimeMs } = statSync(manifest);

    if (shipped?.mtimeMs !== mtimeMs) {
      shipped = {
        set: EquipmentIconSetSchema.parse(JSON.parse(readFileSync(manifest, "utf-8"))),
        mtimeMs,
      };
    }

    return shipped.set;
  } catch {
    return { icons: {} };
  }
}

export function ownEquipmentIconsDir(): string {
  const configured = SERVER_CONFIG.UPLOADS_DIR;

  if (configured === "/app/uploads" && process.env.NODE_ENV !== "production") {
    return path.join(path.resolve("./.runtime/uploads"), "equipment-icons");
  }

  return path.join(configured, "equipment-icons");
}

export function equipmentIconAddress(file: string | null): string | null {
  return file ? `${EQUIPMENT_ICON_ROUTE}/${file}` : null;
}

export function resolveEquipmentIcon(
  id: string,
  ownFile: string | null,
  set: EquipmentIconSet = shippedEquipmentIconSet()
): { address: string | null; own: boolean } {
  const file = ownFile ?? set.icons[id] ?? null;

  return {
    address: equipmentIconAddress(file),
    own: ownFile !== null,
  };
}

export async function storeEquipmentIcon(
  picture: Buffer
): Promise<{ file: string; address: string }> {
  const bytes = await makeIngredientIcon(picture);
  const file = iconFileName(bytes);
  const dir = ownEquipmentIconsDir();

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, file), bytes);

  return { file, address: `${EQUIPMENT_ICON_ROUTE}/${file}` };
}

export async function claimOwnEquipmentIcon(file: string): Promise<boolean> {
  if (!ICON_FILE_PATTERN.test(file)) return false;

  try {
    const now = new Date();

    await fs.utimes(path.join(ownEquipmentIconsDir(), file), now, now);

    return true;
  } catch {
    return false;
  }
}

export async function equipmentIconAddresses(
  ids: readonly string[]
): Promise<Map<string, string | null>> {
  const icons = await findEquipmentIcons(ids);
  const set = shippedEquipmentIconSet();
  const addresses = new Map<string, string | null>();

  for (const id of new Set(ids)) {
    const ownFile = icons.get(id) ?? null;

    addresses.set(id, resolveEquipmentIcon(id, ownFile, set).address);
  }

  return addresses;
}
