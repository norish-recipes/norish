import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { CiqualTable } from "./datasets/ciqual";
import type { SourceFood } from "./datasets/types";
import type { UsdaFood } from "./datasets/usda";
import { readCalnut } from "./datasets/calnut";
import { readCiqualTable, readCiqualWorkbook } from "./datasets/ciqual";
import { readCofid } from "./datasets/cofid";
import { readUsda } from "./datasets/usda";

/** The downloads the table is built from, by the name they are saved under. */
export const DOWNLOADS = {
  taxonomy: "ingredients.txt",
  ciqual: "ciqual-2025.xlsx",
  ciqual2020: "ciqual-2020.csv",
  calnut: "calnut.csv",
  usdaSrLegacy: "usda-sr-legacy.zip",
  usdaFoundation: "usda-foundation.zip",
  cofid: "cofid.xlsx",
} as const;

export type Download = keyof typeof DOWNLOADS;

/** Every dataset, read. */
export interface Sources {
  taxonomy: string;
  ciqual: CiqualTable;
  ciqual2020: CiqualTable;
  calnut: SourceFood[];
  usda: UsdaFood[];
  cofid: SourceFood[];
}

/** Read every download saved in `dir`. */
export async function readSources(dir: string): Promise<Sources> {
  const file = (download: Download) => readFile(join(dir, DOWNLOADS[download]));
  const [srLegacy, foundation] = await Promise.all([
    file("usdaSrLegacy").then((bytes) => readUsda(bytes, "sr-legacy")),
    file("usdaFoundation").then((bytes) => readUsda(bytes, "foundation")),
  ]);

  return {
    taxonomy: (await file("taxonomy")).toString("utf8"),
    ciqual: await readCiqualWorkbook(await file("ciqual")),
    ciqual2020: readCiqualTable((await file("ciqual2020")).toString("utf8")),
    calnut: readCalnut((await file("calnut")).toString("utf8")),
    usda: [...srLegacy, ...foundation],
    cofid: await readCofid(await file("cofid")),
  };
}
