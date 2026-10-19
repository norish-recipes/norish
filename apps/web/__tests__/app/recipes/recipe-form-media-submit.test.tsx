/**
 * The recipe form's media payload.
 *
 * The gallery shows a star on each image after the first, and the form must
 * send the reordered images to the update mutation. The Generated Image does
 * not count against the ten Source Image cap, and its marker must survive the
 * save.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import RecipeForm from "@/app/(app)/recipes/edit/components/recipe-form";

import type { FullRecipeDTO } from "@norish/shared/contracts";

const mocks = vi.hoisted(() => ({
  updateRecipe: vi.fn(),
  createRecipe: vi.fn(),
  allowNavigation: vi.fn(),
  disallowNavigation: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img alt={alt} src={src} />,
}));

vi.mock("@heroui/react", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

  return {
    Button: ({
      children,
      onPress,
      isDisabled,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      isDisabled?: boolean;
    }) => (
      <button disabled={isDisabled} type="button" onClick={onPress}>
        {children}
      </button>
    ),
    Chip: Passthrough,
    FieldError: Passthrough,
    Input: ({ placeholder }: { placeholder?: string }) => <input placeholder={placeholder} />,
    Label: Passthrough,
    TextField: Passthrough,
  };
});

vi.mock("@/context/recipes-context", () => ({
  useRecipesContext: () => ({
    createRecipe: mocks.createRecipe,
    updateRecipe: mocks.updateRecipe,
  }),
}));

vi.mock("@/hooks/config", () => ({
  useUnitsQuery: () => ({ units: {}, isLoading: false }),
}));

vi.mock("@/hooks/recipes", () => ({
  useRecipeId: () => ({
    recipeId: "11111111-1111-4111-8111-111111111111",
    isLoading: false,
    error: null,
  }),
  useRecipeImages: () => ({ uploadGalleryImage: vi.fn(), deleteGalleryImage: vi.fn() }),
  useRecipeVideos: () => ({ uploadGalleryVideo: vi.fn(), deleteGalleryVideo: vi.fn() }),
}));

vi.mock("@/hooks/use-unsaved-navigation-guard", () => ({
  useUnsavedNavigationGuard: () => ({
    allowNavigation: mocks.allowNavigation,
    confirmNavigation: vi.fn(),
    disallowNavigation: mocks.disallowNavigation,
  }),
}));

vi.mock("@/hooks/use-clipboard-image-paste", () => ({
  useClipboardImagePaste: () => ({ getOnPasteHandler: () => vi.fn() }),
}));

vi.mock("@/components/recipes/ingredient-input", () => ({ default: () => <div /> }));
vi.mock("@/components/recipes/measurement-system-selector", () => ({ default: () => <div /> }));
vi.mock("@/components/recipes/step-input", () => ({ default: () => <div /> }));
vi.mock("@/components/recipes/time-inputs", () => ({ default: () => <div /> }));
vi.mock("@/components/shared/smart-input-help", () => ({ default: () => <div /> }));
vi.mock("@/components/shared/smart-text-input", () => ({ default: () => <div /> }));
vi.mock("@/components/shared/tag-input", () => ({ default: () => <div /> }));
vi.mock("@/components/skeleton/edit-recipe-skeleton", () => ({ default: () => <div /> }));
vi.mock("@/app/(app)/recipes/edit/components/provenance-fields", () => ({
  default: () => <div />,
  EMPTY_PROVENANCE_FORM_VALUE: {
    originCountry: null,
    originCountryName: null,
    originRegion: "",
    provenanceNote: "",
    cuisineIds: [],
  },
}));

const RECIPE_ID = "11111111-1111-4111-8111-111111111111";

const initialData: FullRecipeDTO = {
  id: RECIPE_ID,
  userId: "user-1",
  name: "Chocolate Cake",
  description: "Rich and simple",
  image: "/recipes/cake-drawn.jpg",
  url: null,
  servings: 8,
  prepMinutes: 20,
  cookMinutes: 35,
  totalMinutes: 55,
  notes: null,
  systemUsed: "metric",
  calories: null,
  fat: null,
  carbs: null,
  protein: null,
  originCountry: null,
  originCountryName: null,
  originRegion: null,
  provenanceNote: null,
  cuisines: [],
  createdAt: new Date("2026-05-01T10:00:00.000Z"),
  updatedAt: new Date("2026-05-01T10:00:00.000Z"),
  categories: [],
  version: 3,
  recipeIngredients: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      ingredientId: null,
      ingredientName: "Flour",
      amount: 200,
      unit: "g",
      order: 0,
      systemUsed: "metric",
      version: 1,
    },
  ],
  steps: [
    {
      step: "Mix the ingredients",
      systemUsed: "metric",
      order: 0,
      version: 1,
      images: [],
      stepIngredients: [],
    },
  ],
  tags: [],
  author: undefined,
  images: [
    {
      id: "image-drawn",
      image: "/recipes/cake-drawn.jpg",
      order: 0,
      generated: true,
      version: 1,
    },
    {
      id: "image-photo",
      image: "/recipes/cake-photo.jpg",
      order: 1,
      generated: false,
      version: 1,
    },
  ],
  videos: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RecipeForm media payload", () => {
  it("counts Source Images for the cap, not the Generated Image", () => {
    render(<RecipeForm mode="edit" initialData={initialData} />);

    expect(screen.getByText("1/10 images, 0/5 videos")).toBeInTheDocument();
  });

  it("sends the reordered images, with the Generated Image marker kept, to the update mutation", async () => {
    const user = userEvent.setup();

    render(<RecipeForm mode="edit" initialData={initialData} />);

    await user.click(screen.getByRole("button", { name: "setAsThumbnail" }));
    await user.click(screen.getByRole("button", { name: "saveChanges" }));

    await waitFor(() => expect(mocks.updateRecipe).toHaveBeenCalledTimes(1));

    const payload = mocks.updateRecipe.mock.calls[0]?.[1] as {
      images: { id: string; order: number; generated?: boolean }[];
    };

    expect(payload.images).toEqual([
      expect.objectContaining({ id: "image-photo", order: 0, generated: false }),
      expect.objectContaining({ id: "image-drawn", order: 1, generated: true }),
    ]);
  });
});
