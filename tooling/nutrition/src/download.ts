import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { SourceTable } from "@norish/shared-server/ingredients/nutrition/source-table";

import type { Download } from "./sources";
import { DOWNLOADS } from "./sources";

/**
 * Fetching the datasets from where their publishers put them. The newest
 * edition is found on each publisher's download page rather than pinned,
 * because ANSES moves its links with every edition; a page that no longer
 * lists one is a failed run, which the next month's run tries again.
 */

const TAXONOMY_URL =
  "https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/taxonomies/food/ingredients.txt";
const CIQUAL_PAGE = "https://ciqual.anses.fr/cms/en/download";
const FDC_PAGE = "https://fdc.nal.usda.gov/download-datasets/";
const COFID_PAGE =
  "https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid";
/** CIQUAL 2020 and CALNUT 2020 as Open Food Facts vendors them: ANSES now serves 2025 only. */
const OFF_CIQUAL =
  "https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/external-data/ciqual";
const CIQUAL_2020_URL = `${OFF_CIQUAL}/ciqual/CIQUAL2020_ENG_2020_07_07.csv`;
const CALNUT_URL = `${OFF_CIQUAL}/calnut/CALNUT.csv.0`;

const USER_AGENT = "Norish nutrition source build (https://github.com/norish-recipes/norish)";

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) throw new Error(`Fetching ${url} failed: HTTP ${response.status}`);

  return response;
}

/** The links a page lists, absolute. */
async function links(page: string): Promise<string[]> {
  const html = await (await fetchOk(page)).text();

  return [...html.matchAll(/href="([^"]+)"/g)].map((match) =>
    new URL(match[1]!.replace(/&amp;/g, "&"), page).toString()
  );
}

/** The link whose captured date or year sorts last: the newest edition. */
function newest(
  found: readonly string[],
  pattern: RegExp,
  what: string
): { url: string; edition: string } {
  const editions = found.flatMap((url) => {
    const match = pattern.exec(decodeURIComponent(url));

    return match ? [{ url, edition: match[1]!.replace(/_/g, "-") }] : [];
  });

  editions.sort((a, b) => (a.edition < b.edition ? 1 : -1));

  if (!editions[0]) throw new Error(`No ${what} download is listed any more`);

  return editions[0];
}

export interface Located {
  urls: Record<Download, string>;
  editions: SourceTable["editions"];
}

/** Where each download is today, and which edition it is. */
export async function locateDownloads(): Promise<Located> {
  const [ciqualLinks, fdcLinks, cofidLinks] = await Promise.all([
    links(CIQUAL_PAGE),
    links(FDC_PAGE),
    links(COFID_PAGE),
  ]);
  const ciqual = newest(ciqualLinks, /Table Ciqual \d{4}_ENG_(\d{4}_\d{2}_\d{2})\.xlsx$/, "CIQUAL");
  const srLegacy = newest(
    fdcLinks,
    /FoodData_Central_sr_legacy_food_csv_(\d{4}-\d{2})\.zip$/,
    "SR Legacy"
  );
  const foundation = newest(
    fdcLinks,
    /FoodData_Central_foundation_food_csv_(\d{4}-\d{2}-\d{2})\.zip$/,
    "Foundation Foods"
  );
  const cofid = newest(
    cofidLinks,
    /McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_(\d{4})\.+xlsx$/,
    "CoFID"
  );

  return {
    urls: {
      taxonomy: TAXONOMY_URL,
      ciqual: ciqual.url,
      ciqual2020: CIQUAL_2020_URL,
      calnut: CALNUT_URL,
      usdaSrLegacy: srLegacy.url,
      usdaFoundation: foundation.url,
      cofid: cofid.url,
    },
    editions: {
      ciqual: ciqual.edition,
      "ciqual-2020": "2020-07-07",
      calnut: "2020-07-07",
      usda: `SR Legacy ${srLegacy.edition}, Foundation Foods ${foundation.edition}`,
      cofid: cofid.edition,
    },
  };
}

/** Fetch every download into `dir`, under the names `readSources` reads. */
export async function downloadAll(dir: string, located: Located): Promise<void> {
  await mkdir(dir, { recursive: true });
  await Promise.all(
    (Object.keys(DOWNLOADS) as Download[]).map(async (download) => {
      const bytes = new Uint8Array(await (await fetchOk(located.urls[download])).arrayBuffer());

      await writeFile(join(dir, DOWNLOADS[download]), bytes);
    })
  );
}
