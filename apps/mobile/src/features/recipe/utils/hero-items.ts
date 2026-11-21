import type { FullRecipeDTO } from "@norish/shared/contracts";

export type Item =
  | { kind: "image"; key: string; path: string }
  | { kind: "video"; key: string; path: string; poster: string | null; duration: number | null };

/** The recipe's photos then its videos, each in its stored order. */
export function heroItems(recipe: Pick<FullRecipeDTO, "images" | "videos">): Item[] {
  const byOrder = <T extends { order?: unknown }>(items: readonly T[]) =>
    [...items].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

  return [
    ...byOrder(recipe.images ?? []).map((image, index): Item => ({
      kind: "image",
      key: `image-${index}`,
      path: image.image,
    })),
    ...byOrder(recipe.videos ?? []).map((video, index): Item => ({
      kind: "video",
      key: `video-${video.id ?? index}`,
      path: video.video,
      poster: video.thumbnail ?? null,
      duration: video.duration ?? null,
    })),
  ];
}

/** A step's photos as viewer items, keyed by place: the same picture can sit twice in a step. */
export const imageItems = (images: readonly { image: string }[]): Item[] =>
  images.map(({ image }, index) => ({ kind: "image", key: `photo-${index}`, path: image }));
