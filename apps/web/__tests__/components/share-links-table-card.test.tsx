import ShareLinksTableCard from "@/components/recipes/share-links-table-card";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { RecipeShareInventoryDto } from "@norish/shared/contracts/dto/recipe-shares";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      "common.actions.cancel": "Cancel",
      "common.actions.confirm": "Confirm",
      "common.status.loading": "Loading",
      "settings.user.shareLinks.title": "Share links",
      "settings.user.shareLinks.description": "Manage links",
      "settings.user.shareLinks.empty": "No links",
      "settings.user.shareLinks.table.actions": "Actions",
      "settings.user.shareLinks.table.created": "Created",
      "settings.user.shareLinks.table.expires": "Expires",
      "settings.user.shareLinks.table.recipe": "Recipe",
      "settings.user.shareLinks.table.status": "Status",
      "settings.user.shareLinks.deleteModal.title": "Delete link",
      "settings.user.shareLinks.reactivateModal.title": "Reactivate link",
      "settings.user.shareLinks.revokeModal.title": "Revoke link",
    };

    return (key: string) => translations[namespace ? `${namespace}.${key}` : key] ?? key;
  },
}));

vi.mock("@/hooks/recipes/shared-recipe-hooks", () => ({
  sharedRecipeShareHooks: {
    useRecipeShareMutations: () => ({
      revokeShare: vi.fn(),
      reactivateShare: vi.fn(),
      deleteShare: vi.fn(),
      isRevoking: false,
      isReactivating: false,
      isDeleting: false,
    }),
  },
}));

vi.mock("@/app/(app)/settings/components/new-feature-chip", () => ({
  default: () => null,
}));

describe("ShareLinksTableCard", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );

    vi.stubGlobal("CSS", {
      escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&"),
    });
  });

  it("renders populated rows with HeroUI table collections", () => {
    const shares: RecipeShareInventoryDto[] = [
      {
        id: "share-1",
        recipeId: "recipe-1",
        recipeName: "Pasta",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        expiresAt: null,
        status: "active",
        version: 1,
      },
    ];

    render(
      <ShareLinksTableCard isLoading={false} namespace="settings.user.shareLinks" shares={shares} />
    );

    expect(screen.getByText("Pasta")).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "Share links" })).toBeInTheDocument();
  });

  it("renders a simple none state when no share links exist", () => {
    render(
      <ShareLinksTableCard isLoading={false} namespace="settings.user.shareLinks" shares={[]} />
    );

    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.queryByRole("grid", { name: "Share links" })).not.toBeInTheDocument();
  });
});
