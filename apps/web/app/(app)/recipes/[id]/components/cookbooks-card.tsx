"use client";

import { useState } from "react";
import Link from "next/link";
import { useRecipeContext } from "@/app/(app)/recipes/[id]/context";
import { CookbookIconSolid } from "@/components/cookbooks/cookbook-icon";
import { MiniCookbooks } from "@/components/Panel/consumers";
import { useRecipeCookbooksQuery } from "@/hooks/cookbooks";
import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";
import { withOrigin } from "@/lib/back-destination";
import { Button, Card, Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * Whether the cookbooks section has anything to show for this reader.
 *
 * A Hidden Item, so a reader who does not use cookbooks turns it off once,
 * per device — exactly as they can with Nutrition Information or the rating.
 * The page layouts read this too, so the rules they draw between sections
 * come from the same answer the card itself renders by.
 */
export function useCookbooksSectionVisible(): boolean {
  const { showCookbooks } = useHiddenItemVisibility();

  return showCookbooks;
}

/** The cookbooks a recipe is in, at the end of the recipe page. */
export default function CookbooksCard() {
  const { recipe } = useRecipeContext();
  const t = useTranslations("recipes.cookbooks");
  const isVisible = useCookbooksSectionVisible();
  const [panelOpen, setPanelOpen] = useState(false);
  const { cookbooks } = useRecipeCookbooksQuery(isVisible && recipe ? recipe.id : null);

  if (!recipe || !isVisible) return null;

  return (
    <>
      <Card className="rounded-2xl" data-testid="cookbooks-card">
        <Card.Header className="flex-row items-center justify-between px-6 pt-6 text-left">
          <h2 className="text-lg font-semibold">{t("cardTitle")}</h2>
          <Button
            className="rounded-full"
            data-testid="file-into-cookbook"
            size="sm"
            variant="tertiary"
            onPress={() => setPanelOpen(true)}
          >
            <CookbookIconSolid className="size-4" />
            {t("fileIt")}
          </Button>
        </Card.Header>
        <Card.Content className="p-6 pt-0">
          {cookbooks.length === 0 ? (
            <p className="text-muted text-base">{t("cardInvitation")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {cookbooks.map((cookbook) => (
                <Link
                  key={cookbook.id}
                  href={withOrigin(`/cookbooks/${cookbook.id}`, `/recipes/${recipe.id}`)}
                >
                  <Chip
                    className="cursor-pointer rounded-full px-3"
                    data-cookbook-chip={cookbook.title}
                    size="md"
                    variant="tertiary"
                  >
                    <Chip.Label>{cookbook.title}</Chip.Label>
                  </Chip>
                </Link>
              ))}
            </div>
          )}
        </Card.Content>
      </Card>

      <MiniCookbooks open={panelOpen} recipeId={recipe.id} onOpenChange={setPanelOpen} />
    </>
  );
}
