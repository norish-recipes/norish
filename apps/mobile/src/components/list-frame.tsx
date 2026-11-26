import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { FlatList, View } from "react-native";
import { CountCardSkeleton } from "@/components/count-row";
import { EmptyCard } from "@/components/empty-card";
import { ListHeading } from "@/components/list-heading";
import { PageControls } from "@/components/page-controls";
import { SearchFilterRow } from "@/components/search-filter-row";
import { useText } from "@/lib/i18n/use-text";

import { useConnectivity } from "@norish/shared-react/offline/react";

type Empty = Omit<ComponentProps<typeof EmptyCard>, "placement">;

/** A list under page controls: a skeleton while loading, Retry when failed (offline, its note),
 * `blank` when empty, else rows or `nothing`. `testID` prefixes each state's card, `-list`, `-heading`. */
export function ListFrame<T>({
  testID,
  loading,
  failed,
  blank,
  search,
  above,
  heading,
  nothing,
  footer,
  ...list
}: {
  testID: string;
  loading: boolean;
  failed?: { title: string; onRetry: () => void };
  blank?: Empty;
  search: ComponentProps<typeof SearchFilterRow>;
  above?: ReactNode;
  /** The list's heading over its first card; null keeps its room, so the cards stay put as it goes. */
  heading?: string | null;
  nothing?: Empty;
  /** What closes the list, 16 pt under its last row, at the page's side inset. */
  footer?: ReactNode;
  data: readonly T[];
  keyExtractor: (row: T) => string;
  renderItem: ComponentProps<typeof FlatList<T>>["renderItem"];
  onEndReached?: () => void;
}) {
  const text = useText();
  const { isOffline } = useConnectivity();
  // One card in the list's place: the read's state, or why it holds nothing.
  const card = failed ? (
    isOffline ? (
      <EmptyCard
        icon="cloud-offline-outline"
        placement="screen"
        testID={`${testID}-offline`}
        title={text("settings.content.listOffline")}
      />
    ) : (
      <EmptyCard
        action={{
          label: text("common.actions.retry"),
          icon: "refresh-outline",
          testID: `${testID}-retry`,
          onPress: failed.onRetry,
        }}
        icon="alert-circle-outline"
        placement="screen"
        testID={`${testID}-failed`}
        title={failed.title}
      />
    )
  ) : loading ? (
    <View testID={`${testID}-skeleton`}>
      <CountCardSkeleton />
    </View>
  ) : blank ? (
    <EmptyCard placement="screen" {...blank} />
  ) : nothing ? (
    <EmptyCard placement="screen" {...nothing} />
  ) : null;
  const listed = !failed && !loading && !blank;

  // The controls stay in every state; a card takes the heading's room too, so it sits where the
  // first card of rows does.
  const header = (
    <>
      <PageControls>
        <SearchFilterRow {...search} />
        {above}
      </PageControls>
      <Gap>
        {heading === undefined && !card ? null : (
          <ListHeading testID={heading ? `${testID}-heading` : undefined} title={heading ?? ""} />
        )}
        {card}
      </Gap>
    </>
  );

  return (
    <FlatList
      {...list}
      ListFooterComponent={
        footer && listed ? (
          <Gap>
            <View className="px-5">{footer}</View>
          </Gap>
        ) : undefined
      }
      ListHeaderComponent={header}
      contentContainerClassName="pb-16"
      contentInsetAdjustmentBehavior="never"
      data={listed ? list.data : []}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      testID={`${testID}-list`}
      onEndReachedThreshold={list.onEndReached ? 0.6 : undefined}
    />
  );
}

/** What sits under the page controls, 16 pt below them. */
function Gap({ children }: { children: ReactNode }) {
  return <View className="pt-4">{children}</View>;
}
