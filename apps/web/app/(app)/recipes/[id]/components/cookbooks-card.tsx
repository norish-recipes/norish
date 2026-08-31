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
 * The cookbooks a recipe is in, at the end of the recipe page.
 *
 * It appears only when there are some. A card that invited every reader to
 * file every recipe put a permanent advertisement on the end of a page most
 * readers had not asked for — and the door it offered is already in the quick
 * actions, where filing belongs whether or not the recipe is in anything yet.
 * So this states a fact when there is one and says nothing when there is not.
 *
 * It is also a Hidden Item, so a reader who uses cookbooks but does not want
 * to read about them here turns it off once, per device — exactly as they can
 * with Nutrition Information or the rating.
 */
export default function CookbooksCard() {
  const { recipe } = useRecipeContext();
  const t = useTranslations("recipes.cookbooks");
  const { showCookbooks } = useHiddenItemVisibility();
  const [panelOpen, setPanelOpen] = useState(false);
  const { cookbooks } = useRecipeCookbooksQuery(showCookbooks && recipe ? recipe.id : null);

  if (!recipe || !showCookbooks || cookbooks.length === 0) return null;

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
            {t("manage")}
          </Button>
        </Card.Header>
        <Card.Content className="p-6 pt-0">
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
        </Card.Content>
      </Card>

      <MiniCookbooks open={panelOpen} recipeId={recipe.id} onOpenChange={setPanelOpen} />
    </>
  );
}
