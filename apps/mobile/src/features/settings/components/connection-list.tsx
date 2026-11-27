import type { ReactNode } from "react";
import React, { useEffect, useEffectEvent } from "react";
import { EmptyCard } from "@/components/empty-card";
import { isOfflineNow } from "@/lib/offline/offline-now";

import type { ReadStatus } from "@norish/shared-react/reader";

import { readState } from "../utils/read-state";
import { ReadBody } from "./read-body";

/** The body of a connections page: its rows, or the loading skeleton, a failed load with Retry, or
 * the empty card, by how `read` went and how many rows it holds. Opening it Live rereads a held
 * list, which no subscription keeps current. */
export function ConnectionList({
  read,
  count,
  name,
  emptyTitle,
  emptyIcon,
  children,
}: {
  read: ReadStatus;
  count: number;
  /** Names the test ids. */
  name: string;
  emptyTitle: string;
  emptyIcon: React.ComponentProps<typeof EmptyCard>["icon"];
  children: ReactNode;
}) {
  const { answered, isLoading, error } = read;
  const reread = useEffectEvent(() => {
    if (read.answered && !isOfflineNow()) read.refetch();
  });

  useEffect(() => reread(), []);

  return (
    <ReadBody
      empty={
        <EmptyCard
          icon={emptyIcon}
          placement="section"
          testID={`${name}-empty`}
          title={emptyTitle}
        />
      }
      name={name}
      state={readState({ held: count > 0, answered, isLoading, error })}
      onRetry={read.refetch}
    >
      {children}
    </ReadBody>
  );
}
