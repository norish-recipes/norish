import { Readable } from "node:stream";
import type { Archiver } from "archiver";
import archiver from "archiver";

import { FullRecipeDTO } from "@norish/shared/contracts";

import {
  EXTERNAL_MEDIA_URL,
  NORISH_ARCHIVE_FORMAT,
  NORISH_ARCHIVE_FORMAT_VERSION,
  NORISH_ARCHIVE_MANIFEST_FILE,
  NORISH_ARCHIVE_MEDIA_DIRS,
  NORISH_ARCHIVE_RECIPE_FILE,
  NorishArchiveRecipe,
  NorishManifest,
} from "./norish-format";

/** A media file that belongs inside a recipe's folder in the archive. */
export type NorishArchiveMediaRef = {
  /** The web path as stored on the recipe record, e.g. `/recipes/<id>/hero.jpg` */
  webPath: string;
  /** The path inside the recipe's archive folder, e.g. `images/hero.jpg` */
  archivePath: string;
};

export type NorishArchiveMedia = NorishArchiveMediaRef & {
  /**
   * Produces the media bytes when the archive reaches this entry. Returning
   * a fresh stream per call keeps large exports from holding every file open
   * (or in memory) at once.
   */
  source: () => Readable;
};

/**
 * One recipe to write into the archive: the full record as the recipe
 * listing layer loads it, plus handles for the media that exists on disk.
 * The writer knows nothing about visibility, HTTP, or the filesystem —
 * scope and media handles are the caller's problem (ADR-0022).
 */
export type NorishArchiveRecord = {
  recipe: FullRecipeDTO;
  media?: NorishArchiveMedia[];
  /** The exporter's own rating (1-5) — never anyone else's */
  rating?: number;
  /** The exporter's own favourite mark — never anyone else's */
  favorite?: boolean;
};

export type NorishArchiveExporter = {
  /** The exporting user's display name — never an email or account id */
  name: string | null;
  /** The exporting instance's public origin URL */
  origin: string;
};

export type NorishArchiveInput = {
  /**
   * Yielded as they load, so entries are written while the rest of the
   * library is still being read.
   */
  records: AsyncIterable<NorishArchiveRecord>;
  exporter: NorishArchiveExporter;
  exportedAt: Date;
  /** What the manifest declares it set out to write */
  recipeCount: number;
};

/**
 * The basename of a media web path under the recipe's own directory, or
 * null when the value points elsewhere (another recipe, an external URL).
 */
function localMediaBasename(
  value: string | null | undefined,
  recipeId: string,
  subDirectory = ""
): string | null {
  if (!value) return null;

  const prefix = `/recipes/${recipeId}/${subDirectory}`;

  if (!value.startsWith(prefix)) return null;

  const basename = value.slice(prefix.length);

  if (!basename || basename.includes("/")) return null;

  return basename;
}

/**
 * Every local media file a recipe references, mapped to its place in the
 * archive layout (`NORISH_ARCHIVE_MEDIA_DIRS`): gallery and hero images
 * under `images/`, step images under `steps/`, videos and their thumbnails
 * under `videos/`. The export's load step uses this to find files on disk;
 * the writer uses it to rewrite references.
 */
export function collectRecipeMediaRefs(recipe: FullRecipeDTO): NorishArchiveMediaRef[] {
  const refs: NorishArchiveMediaRef[] = [];
  const seen = new Set<string>();

  const add = (webPath: string | null | undefined, archivePath: string | null) => {
    if (!webPath || !archivePath || seen.has(webPath)) return;
    seen.add(webPath);
    refs.push({ webPath, archivePath });
  };

  const heroBasename = localMediaBasename(recipe.image, recipe.id);

  add(recipe.image, heroBasename && `${NORISH_ARCHIVE_MEDIA_DIRS.images}/${heroBasename}`);

  for (const galleryImage of recipe.images) {
    const basename = localMediaBasename(galleryImage.image, recipe.id);

    add(galleryImage.image, basename && `${NORISH_ARCHIVE_MEDIA_DIRS.images}/${basename}`);
  }

  for (const step of recipe.steps) {
    for (const stepImage of step.images) {
      const basename = localMediaBasename(stepImage.image, recipe.id, "steps/");

      add(stepImage.image, basename && `${NORISH_ARCHIVE_MEDIA_DIRS.steps}/${basename}`);
    }
  }

  for (const video of recipe.videos) {
    const videoBasename = localMediaBasename(video.video, recipe.id);

    add(video.video, videoBasename && `${NORISH_ARCHIVE_MEDIA_DIRS.videos}/${videoBasename}`);

    const thumbnailBasename = localMediaBasename(video.thumbnail, recipe.id);

    add(
      video.thumbnail,
      thumbnailBasename && `${NORISH_ARCHIVE_MEDIA_DIRS.videos}/${thumbnailBasename}`
    );
  }

  return refs;
}

/**
 * Map a full recipe record to the `recipe.json` wire shape.
 *
 * Instance-local identifiers never travel: cuisine ids flatten to names,
 * ingredient ids are nulled in favour of names, and row ids/versions on
 * nested records are dropped entirely. Local media references become
 * relative paths into the recipe's archive folder; external URLs travel
 * unchanged; media that did not make it into the archive is dropped rather
 * than exported as a dead reference.
 *
 * Three export-only fields ride along: the author's display name as
 * attribution (a name and nothing else — no id, no avatar, no email), plus
 * the exporter's own rating and favourite mark. Nobody else's marks and no
 * account data of anyone ever enter the archive (ADR-0022).
 */
function buildArchiveRecipe(record: NorishArchiveRecord): NorishArchiveRecipe {
  const recipe = record.recipe;
  const archivePathByWebPath = new Map(
    (record.media ?? []).map((media) => [media.webPath, media.archivePath])
  );

  const rewriteMedia = (value: string | null | undefined): string | null => {
    if (!value) return null;
    if (EXTERNAL_MEDIA_URL.test(value)) return value;

    return archivePathByWebPath.get(value) ?? null;
  };

  return {
    name: recipe.name,
    description: recipe.description,
    url: recipe.url,
    notes: recipe.notes,
    servings: recipe.servings,
    systemUsed: recipe.systemUsed,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    totalMinutes: recipe.totalMinutes,
    calories: recipe.calories,
    fat: recipe.fat,
    carbs: recipe.carbs,
    protein: recipe.protein,
    originCountry: recipe.originCountry,
    originCountryName: recipe.originCountryName,
    originRegion: recipe.originRegion,
    provenanceNote: recipe.provenanceNote,
    categories: recipe.categories,
    tags: recipe.tags.map((tag) => ({ name: tag.name })),
    cuisines: recipe.cuisines.map((cuisine) => cuisine.name),
    recipeIngredients: recipe.recipeIngredients.map((ingredient) => ({
      ingredientId: null,
      ingredientName: ingredient.ingredientName,
      amount: ingredient.amount,
      unit: ingredient.unit,
      systemUsed: ingredient.systemUsed,
      order: ingredient.order,
    })),
    steps: recipe.steps.map((step) => ({
      step: step.step,
      order: step.order,
      systemUsed: step.systemUsed,
      images: step.images.flatMap((stepImage) => {
        const image = rewriteMedia(stepImage.image);

        return image ? [{ image, order: stepImage.order }] : [];
      }),
      stepIngredients: step.stepIngredients.map((stepIngredient) => ({
        ingredientOrder: stepIngredient.ingredientOrder,
        share: stepIngredient.share,
        order: stepIngredient.order,
      })),
    })),
    image: rewriteMedia(recipe.image),
    images: recipe.images.flatMap((galleryImage) => {
      const image = rewriteMedia(galleryImage.image);

      return image ? [{ image, order: galleryImage.order }] : [];
    }),
    videos: recipe.videos.flatMap((video) => {
      const rewrittenVideo = rewriteMedia(video.video);

      if (!rewrittenVideo) return [];

      return [
        {
          video: rewrittenVideo,
          thumbnail: rewriteMedia(video.thumbnail),
          duration: video.duration ?? null,
          order: video.order,
        },
      ];
    }),
    authorName: recipe.author?.name ?? null,
    rating: record.rating,
    favorite: record.favorite,
  };
}

/**
 * How much finished zip output may sit unread before the writer stops
 * producing. A paused download must not let the loop run the whole library
 * into memory; a reading one never reaches this.
 */
const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;
const BACKPRESSURE_POLL_MS = 25;

function buildManifest(input: NorishArchiveInput): NorishManifest {
  return {
    format: NORISH_ARCHIVE_FORMAT,
    formatVersion: NORISH_ARCHIVE_FORMAT_VERSION,
    exportedAt: input.exportedAt.toISOString(),
    exporter: {
      name: input.exporter.name,
      origin: input.exporter.origin,
    },
    // What the export set out to write. Entries are the ground truth on
    // import, which is why a recipe that vanishes mid-stream can simply be
    // left out rather than invalidating the archive.
    recipeCount: input.recipeCount,
  };
}

function appendRecord(archive: Archiver, record: NorishArchiveRecord): void {
  archive.append(JSON.stringify(buildArchiveRecipe(record), null, 2), {
    name: `${record.recipe.id}/${NORISH_ARCHIVE_RECIPE_FILE}`,
  });

  // Media is stored, not deflated: images and videos are already compressed,
  // and skipping DEFLATE keeps a video-heavy export cheap to stream.
  for (const media of record.media ?? []) {
    archive.append(media.source(), {
      name: `${record.recipe.id}/${media.archivePath}`,
      store: true,
    });
  }
}

/**
 * Write a Recipe Archive as a stream: root manifest first, then one folder
 * per recipe keyed by its recipe id with that recipe's media inside.
 *
 * Records arrive as an async iterable and entries are appended as they do,
 * so the first bytes reach the client while the server is still reading
 * recipes — nobody waits for the whole library to be assembled, and no
 * artifact is ever built server-side (ADR-0022). A record the source cannot
 * produce is simply never yielded, so a recipe deleted mid-export drops out
 * instead of corrupting the download.
 */
export function streamNorishArchive(input: NorishArchiveInput): Readable {
  const archive = archiver("zip", { zlib: { level: 6 } });

  archive.append(JSON.stringify(buildManifest(input), null, 2), {
    name: NORISH_ARCHIVE_MANIFEST_FILE,
  });

  void (async () => {
    try {
      for await (const record of input.records) {
        appendRecord(archive, record);

        // The consumer sets the pace: while finished output sits unread,
        // stop pulling recipes rather than racing ahead of the download.
        while (archive.readableLength > MAX_BUFFERED_BYTES) {
          await new Promise((resolve) => setTimeout(resolve, BACKPRESSURE_POLL_MS));
        }
      }

      await archive.finalize();
    } catch (error) {
      // The response has already begun, so there is no status code left to
      // send: destroying the stream is what tells the client the download is
      // not the whole archive.
      archive.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return archive;
}
