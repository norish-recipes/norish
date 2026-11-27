import ShareLinksTableCard from "@/components/settings/share-links-table-card";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type {
  AdminRecipeShareInventoryDto,
  RecipeShareInventoryDto,
} from "@norish/shared/contracts/dto/recipe-shares";

vi.mock("next-intl", () => ({
  useFormatter: () => ({ dateTime: (date: Date) => date.toISOString() }),
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      "common.actions.cancel": "Cancel",
      "common.actions.confirm": "Confirm",
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
      "settings.admin.shareLinks.title": "Recipe share moderation",
      "settings.admin.shareLinks.inactive": "Inactive",
      "settings.admin.shareLinks.table.owner": "Owner",
      "settings.admin.shareLinks.table.recipe": "Recipe",
      "settings.admin.shareLinks.revokeModal.title": "Revoke link",
      "settings.admin.shareLinks.revokeModal.message": "Revoke {recipeName}",
      "settings.admin.shareLinks.revokeModal.confirm": "Revoke",
      "recipes.sharePanel.status.active": "Active",
    };

    return (key: string) => translations[namespace ? `${namespace}.${key}` : key] ?? key;
  },
}));

const mutations = {
  revokeShare: vi.fn(async () => true),
  reactivateShare: vi.fn(async () => true),
  deleteShare: vi.fn(async () => true),
  isRevoking: false,
  isReactivating: false,
  isDeleting: false,
};

vi.mock("@/components/settings/new-feature-chip", () => ({
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
        userId: "user-1",
        recipeId: "recipe-1",
        recipeName: "Pasta",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        expiresAt: null,
        revokedAt: null,
        lastAccessedAt: null,
        status: "active",
        hasLink: true,
        version: 1,
      },
    ];

    render(
      <ShareLinksTableCard
        isLoading={false}
        mutations={mutations}
        namespace="settings.user.shareLinks"
        shares={shares}
      />
    );

    expect(screen.getByText("Pasta")).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "Share links" })).toBeInTheDocument();
  });

  it("says so in a line when no share links exist", () => {
    render(
      <ShareLinksTableCard
        isLoading={false}
        mutations={mutations}
        namespace="settings.user.shareLinks"
        shares={[]}
      />
    );

    expect(screen.getByText("No links")).toBeInTheDocument();
    expect(screen.queryByRole("grid", { name: "Share links" })).not.toBeInTheDocument();
  });

  it("shows an admin who made each link, marks one its maker may not view, and revokes it", async () => {
    const share = (id: string, ownerName: string, makerMayView: boolean) => ({
      id,
      userId: `user-${id}`,
      recipeId: `recipe-${id}`,
      recipeName: `Soup ${id}`,
      ownerId: `user-${id}`,
      ownerName,
      makerMayView,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      expiresAt: null,
      revokedAt: null,
      lastAccessedAt: null,
      status: "active" as const,
      hasLink: false,
      version: 4,
    });
    const shares: AdminRecipeShareInventoryDto[] = [
      share("a", "Ann", true),
      share("b", "Bob", false),
    ];

    render(
      <ShareLinksTableCard
        showOwner
        isLoading={false}
        mutations={mutations}
        namespace="settings.admin.shareLinks"
        shares={shares}
      />
    );

    expect(screen.getByRole("columnheader", { name: "Owner" })).toBeInTheDocument();
    expect(screen.getByText("Ann")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Soup a/ })).getByText("Active")).toBeVisible();
    expect(within(screen.getByRole("row", { name: /Soup b/ })).getByText("Inactive")).toBeVisible();

    fireEvent.click(
      within(screen.getByRole("row", { name: /Soup b/ })).getByRole("button", {
        name: "Revoke link",
      })
    );
    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));

    expect(mutations.revokeShare).toHaveBeenCalledWith("b", 4);
  });
});
