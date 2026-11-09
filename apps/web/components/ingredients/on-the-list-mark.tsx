"use client";

import { CheckIcon } from "@heroicons/react/16/solid";
import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

/** A kept food whose grocery is still to buy: handled, so nobody adds it twice. */
export function OnTheListMark() {
  const t = useTranslations("groceries.pantry");

  return (
    <Chip className="shrink-0" color="accent" data-testid="on-the-list" size="sm" variant="soft">
      <CheckIcon className="size-3" />
      {t("onTheList")}
    </Chip>
  );
}
