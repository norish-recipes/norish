"use client";

import UserAvatar from "@/components/shared/user-avatar";
import { ArrowTopRightOnSquareIcon, GlobeAltIcon } from "@heroicons/react/16/solid";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

export type SourceRecipeLike = {
  url: string | null;
  author?: { id?: string; name?: string | null; image?: string | null } | null;
};

type SourceCardProps = {
  recipe: SourceRecipeLike;
  /** Off where the surrounding page is still one card. */
  inCard?: boolean;
};

/** The host a recipe came from, or the stored string when it will not parse. */
function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Where a recipe came from, as a card of its own — legible, rather than the
 * five-pixel icon that used to sit beside the title.
 *
 * The site it was imported from and the person who imported it are the same
 * question asked twice, so they answer it together as two rows of one list: a
 * leading mark, the name, and — where the row goes somewhere — a hint that it
 * does. Left as free-floating lines they read as two unrelated scraps in a
 * mostly empty card. A recipe with neither has no card.
 */
export default function SourceCard({ recipe, inCard = true }: SourceCardProps) {
  const t = useTranslations("recipes.detail");

  // Narrowed to a name that is actually there, so the credit line never reads
  // "Added by null".
  const author = recipe.author?.name ? { ...recipe.author, name: recipe.author.name } : null;

  if (!recipe.url && !author) return null;

  const content = (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{t("source")}</h2>

      {/* The same divided list the Nutrition legend uses, so two rows of
          reference material read as a list rather than as leftovers. */}
      <div className="divide-border divide-y">
        {recipe.url && (
          <a
            className="text-foreground flex items-center gap-3 py-2.5 no-underline"
            href={recipe.url}
            rel="noopener noreferrer"
            target="_blank"
            title={t("viewOriginal")}
          >
            <span className="bg-accent-soft text-accent flex size-8 shrink-0 items-center justify-center rounded-xl">
              <GlobeAltIcon aria-hidden className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-base">{sourceLabel(recipe.url)}</span>
            <ArrowTopRightOnSquareIcon aria-hidden className="text-muted size-4 shrink-0" />
          </a>
        )}

        {author && (
          <div className="flex items-center gap-3 py-2.5">
            <UserAvatar image={author.image} name={author.name} size="xs" userId={author.id} />
            <span className="text-muted min-w-0 flex-1 truncate text-base">
              {t("addedBy", { name: author.name })}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  if (!inCard) return content;

  return (
    <Card className="rounded-2xl">
      <Card.Content className="p-5">{content}</Card.Content>
    </Card>
  );
}
