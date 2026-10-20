/**
 * Choosing the recipe thumbnail in the media gallery.
 *
 * The gallery has one ordering, so "set as thumbnail" is the star on any image
 * after the first: it moves that image to the front and renumbers the gallery,
 * which is what every reader resolves as the primary image.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { RecipeGalleryMedia } from "@/components/recipes/media-gallery-input";
import MediaGalleryInput from "@/components/recipes/media-gallery-input";

import { primaryRecipeImage } from "@norish/shared/lib/recipe-media";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img alt={alt} src={src} />,
}));

vi.mock("@/hooks/recipes", () => ({
  useRecipeImages: () => ({
    uploadGalleryImage: vi.fn(),
    deleteGalleryImage: vi.fn(),
  }),
  useRecipeVideos: () => ({
    uploadGalleryVideo: vi.fn(),
    deleteGalleryVideo: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-clipboard-image-paste", () => ({
  useClipboardImagePaste: () => ({ getOnPasteHandler: () => vi.fn() }),
}));

const MEDIA: RecipeGalleryMedia[] = [
  { id: "a", type: "image", src: "/recipes/r/a.jpg", order: 0 },
  { id: "b", type: "image", src: "/recipes/r/b.jpg", order: 1 },
  { id: "c", type: "image", src: "/recipes/r/c.jpg", order: 2 },
];

function secondImageAction() {
  const actions = screen.getAllByRole("button", { name: "setAsThumbnail" });
  const action = actions[1];

  if (!action) throw new Error("expected a thumbnail action on the second image");

  return action;
}

describe("MediaGalleryInput thumbnail action", () => {
  it("moves the chosen image first and renumbers the gallery", async () => {
    const onChange = vi.fn<(media: RecipeGalleryMedia[]) => void>();
    const user = userEvent.setup();

    render(<MediaGalleryInput media={MEDIA} recipeId="recipe" onChange={onChange} />);

    // The first image already leads, so only the other two offer the action.
    expect(screen.getAllByRole("button", { name: "setAsThumbnail" })).toHaveLength(2);

    await user.click(secondImageAction());

    const next = onChange.mock.calls[0]?.[0] ?? [];

    expect(next.map((item) => item.id)).toEqual(["c", "a", "b"]);
    expect(next.map((item) => item.order)).toEqual([0, 1, 2]);
  });

  it("makes the chosen image what readers resolve as the primary image", async () => {
    const onChange = vi.fn<(media: RecipeGalleryMedia[]) => void>();
    const user = userEvent.setup();

    render(<MediaGalleryInput media={MEDIA} recipeId="recipe" onChange={onChange} />);

    await user.click(secondImageAction());

    const next = onChange.mock.calls[0]?.[0] ?? [];
    const images = next
      .filter((item) => item.type === "image")
      .map((item) => ({ image: item.src, order: item.order }));

    expect(primaryRecipeImage({ images })).toBe("/recipes/r/c.jpg");
  });

  it("counts Source Images only in the footer", () => {
    render(
      <MediaGalleryInput
        media={[
          { id: "drawn", type: "image", src: "/recipes/r/drawn.jpg", order: 0, generated: true },
          { id: "photo", type: "image", src: "/recipes/r/photo.jpg", order: 1, generated: false },
        ]}
        recipeId="recipe"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("1/10 images, 0/5 videos")).toBeInTheDocument();
  });

  it("offers no thumbnail action for a video", () => {
    render(
      <MediaGalleryInput
        media={[
          { id: "v", type: "video", src: "/recipes/r/v.mp4", order: 0 },
          { id: "a", type: "image", src: "/recipes/r/a.jpg", order: 1 },
        ]}
        recipeId="recipe"
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "setAsThumbnail" })).not.toBeInTheDocument();
  });
});
