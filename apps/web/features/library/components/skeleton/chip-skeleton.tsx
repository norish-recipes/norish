"use client";

import { Skeleton } from "@heroui/react";

export default function ChipSkeleton() {
  return (
    <div className="flex flex-wrap gap-1 pr-1">
      {Array.from({ length: 20 }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-20 rounded-full" />
      ))}
    </div>
  );
}
