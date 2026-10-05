"use client";

import type { ReactNode } from "react";
import NextLink from "next/link";
import { ArchiveBoxIcon, ClipboardDocumentListIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

export type GroceriesView = "list" | "pantry";

const VIEWS = [
  { view: "list", href: "/groceries", icon: ClipboardDocumentListIcon, label: "list" },
  { view: "pantry", href: "/groceries/pantry", icon: ArchiveBoxIcon, label: "pantry" },
] as const;

/**
 * The top of Groceries on both of its views: the title, the _List · Pantry_
 * switch, and whatever controls the view has. The switch is two real links,
 * so each view has an address to bookmark and land on. On a phone it takes
 * its own row under the title, at full width.
 */
export function GroceriesHeader({ view, actions }: { view: GroceriesView; actions?: ReactNode }) {
  const t = useTranslations("groceries.page");

  return (
    <div className="mb-6 flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {actions ? <div className="flex items-center gap-2 md:order-last">{actions}</div> : null}
      <nav
        aria-label={t("views")}
        className="bg-default flex w-full rounded-[calc(var(--radius)*2.5)] p-1 md:mr-auto md:w-auto"
      >
        {VIEWS.map(({ view: target, href, icon: Icon, label }) => {
          const current = target === view;

          return (
            <NextLink
              key={target}
              aria-current={current ? "page" : undefined}
              className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-3xl px-4 text-sm font-medium transition-colors md:flex-none ${
                current
                  ? "bg-segment text-segment-foreground shadow-surface"
                  : "text-muted hover:opacity-70"
              }`}
              href={href}
            >
              <Icon className="size-4 shrink-0" />
              {t(label)}
            </NextLink>
          );
        })}
      </nav>
    </div>
  );
}
