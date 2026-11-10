"use client";

import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { CookingTimeSegmentKind } from "@norish/shared/lib/cooking-time";
import { reconcileCookingTime } from "@norish/shared/lib/cooking-time";
import { formatMinutesHM } from "@norish/shared/lib/helpers";

export type CookingTimeRecipeLike = {
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
};

type CookingTimeCardProps = {
  recipe: CookingTimeRecipeLike;
  /** Off where the surrounding page is still one card. */
  inCard?: boolean;
};

/**
 * Preparation and cooking are two different jobs, so they take two hues rather
 * than the accent at two opacities: one bar in two strengths of the same colour
 * reads as more and less of one thing.
 *
 * Other Time is neutral on purpose — it is the part of the total that is
 * neither of them, and nothing knows which kind it is. A recipe with no split
 * at all has one segment and nothing to tell apart, so it takes the accent.
 */
const segmentFill: Record<CookingTimeSegmentKind, string> = {
  prep: "bg-cooking-prep",
  cook: "bg-cooking-cook",
  other: "bg-surface-tertiary",
  total: "bg-accent",
};

/**
 * A recipe's time as a segmented bar: the stored total as the headline, with
 * prep and cook drawn to scale inside it and any shortfall named as Other
 * Time. Nothing here projects a finish time — that claim belongs to a
 * Cooking Session and lives in cooking mode alone.
 */
export default function CookingTimeCard({ recipe, inCard = true }: CookingTimeCardProps) {
  const t = useTranslations("recipes.cookingTime");
  const breakdown = reconcileCookingTime(recipe);

  if (!breakdown) return null;

  const content = (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <span className="text-foreground text-lg font-semibold tabular-nums">
          {formatMinutesHM(breakdown.totalMinutes)}
        </span>
      </div>

      <div className="bg-surface-secondary flex h-3 w-full overflow-hidden rounded-full">
        {breakdown.segments.map((segment) => (
          <div
            key={segment.kind}
            className={segmentFill[segment.kind]}
            style={{ width: `${segment.share * 100}%` }}
          />
        ))}
      </div>

      {breakdown.segments[0]?.kind !== "total" && (
        <dl className="flex flex-wrap gap-x-5 gap-y-2">
          {breakdown.segments.map((segment) => (
            <div key={segment.kind} className="flex items-center gap-2">
              <span aria-hidden className={`size-2.5 rounded-full ${segmentFill[segment.kind]}`} />
              <dt className="text-muted text-sm">{t(segment.kind)}</dt>
              <dd className="text-foreground text-sm font-medium tabular-nums">
                {formatMinutesHM(segment.minutes)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );

  if (!inCard) return content;

  return (
    <Card className="rounded-2xl">
      <Card.Content className="p-5">{content}</Card.Content>
    </Card>
  );
}
