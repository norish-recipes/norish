import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { FlatList, View } from "react-native";
import { CountCardSkeleton } from "@/components/count-row";
import { EmptyCard } from "@/components/empty-card";
import { PageControls } from "@/components/page-controls";
import { SearchFilterRow } from "@/components/search-filter-row";
import { SheetFieldSkeleton } from "@/components/sheet-input";
import { useText } from "@/lib/i18n/use-text";

type Empty = Omit<ComponentProps<typeof EmptyCard>, "placement">;

/** A list on a page with controls: while it loads, a skeleton shaped like the page; when it failed,
 * Retry; when it holds nothing at all, its `blank` card; else the search row, whatever `above` adds
 * to the controls, a `nothing` card when the search finds none, and the rows. The cards and rows
 * start 16 pt under the controls. `testID` prefixes `-skeleton`, `-failed`, `-retry` and `-list`. */
export function ListFrame<T>({
  testID,
  loading,
  failed,
  blank,
  search,
  above,
  nothing,
  ...list
}: {
  testID: string;
  loading: boolean;
  failed?: { title: string; onRetry: () => void };
  blank?: Empty;
  search: ComponentProps<typeof SearchFilterRow>;
  above?: ReactNode;
  nothing?: Empty;
  data: readonly T[];
  keyExtractor: (row: T) => string;
  renderItem: ComponentProps<typeof FlatList<T>>["renderItem"];
  onEndReached?: () => void;
}) {
  const text = useText();

  if (failed) {
    return (
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
    );
  }

  if (loading) {
    return (
      <View testID={`${testID}-skeleton`}>
        <PageControls>
          <SheetFieldSkeleton />
        </PageControls>
        <View className="h-4" />
        <CountCardSkeleton />
      </View>
    );
  }

  if (blank) return <EmptyCard placement="screen" {...blank} />;

  const header = (
    <>
      <PageControls>
        <SearchFilterRow {...search} />
        {above}
      </PageControls>
      {nothing ? <EmptyCard placement="screen" {...nothing} /> : <View className="h-4" />}
    </>
  );

  return (
    <FlatList
      {...list}
      ListHeaderComponent={header}
      contentContainerClassName="pb-16"
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      testID={`${testID}-list`}
      onEndReachedThreshold={list.onEndReached ? 0.6 : undefined}
    />
  );
}
