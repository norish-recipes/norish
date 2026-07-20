"use client";

import type { ReactNode } from "react";

export function Timestamp({
  className,
  fallback = null,
  value,
}: {
  className?: string;
  fallback?: ReactNode;
  value: number | null;
}) {
  if (value === null) return fallback;

  const date = new Date(value);

  return (
    <time className={className} dateTime={date.toISOString()}>
      {date.toLocaleString()}
    </time>
  );
}
