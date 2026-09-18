"use client";

import { useState } from "react";
import { IngredientsAdminPanel } from "@/components/ingredients-admin/ingredients-admin-panel";
import { useIngredientNamesQuery } from "@/hooks/config";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { Button, Card } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * Ingredients (ADR-0037): every ingredient name recipes use, where an
 * administrator gives names a picture. The card says
 * what it is and how many pictures exist; the list itself opens in a panel.
 */
export default function IngredientsCard() {
  const t = useTranslations("settings.admin.ingredients");
  const { ingredients } = useIngredientNamesQuery();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <PhotoIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="flex flex-col items-start gap-4">
        <p className="text-muted text-base">{t("description")}</p>
        <p className="text-sm" data-testid="ingredients-summary">
          {t("summary", { count: ingredients.length })}
        </p>
        <Button data-testid="ingredients-manage" variant="primary" onPress={() => setOpen(true)}>
          {t("manage")}
        </Button>
      </Card.Content>
      <IngredientsAdminPanel open={open} onOpenChange={setOpen} />
    </Card>
  );
}
