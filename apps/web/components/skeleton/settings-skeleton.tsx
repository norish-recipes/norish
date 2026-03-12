"use client";

import { Card, CardBody, CardHeader, Skeleton } from "@heroui/react";

type Props = {
  /** Number of content rows to show */
  rows?: number;
  /** Show a toggle/switch on the right */
  hasToggle?: boolean;
  /** Header width class */
  headerWidth?: string;
};

export function SettingsCardSkeleton({ rows = 2, hasToggle = false, headerWidth = "w-48" }: Props) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className={`${headerWidth} h-6 rounded-lg`} />
      </CardHeader>
      <CardBody className="gap-4">
        {hasToggle ? (
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-64 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        ) : (
          Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))
        )}
      </CardBody>
    </Card>
  );
}

type SettingsSkeletonProps = {
  /** Card configurations */
  cards?: Props[];
};

/**
 * Generic settings page skeleton with configurable cards
 */
export default function SettingsSkeleton({ cards }: SettingsSkeletonProps) {
  const defaultCards: Props[] = [
    { hasToggle: true, headerWidth: "w-32" },
    { rows: 3, headerWidth: "w-40" },
    { rows: 2, headerWidth: "w-48" },
    { rows: 1, headerWidth: "w-36" },
  ];

  const cardsToRender = cards || defaultCards;

  return (
    <div className="flex w-full flex-col gap-6">
      {cardsToRender.map((cardProps, i) => (
        <SettingsCardSkeleton key={i} {...cardProps} />
      ))}
    </div>
  );
}
