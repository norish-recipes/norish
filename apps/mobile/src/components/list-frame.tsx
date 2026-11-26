import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { FlatList, View } from "react-native";
import { CountCardSkeleton } from "@/components/count-row";
import { EmptyCard } from "@/components/empty-card";
import { ListHeading } from "@/components/list-heading";
import { PageControls } from "@/components/page-controls";
import { SearchFilterRow } from "@/components/search-filter-row";
import { SheetFieldSkeleton } from "@/components/sheet-input";
import { useText } from "@/lib/i18n/use-text";

type Empty = Omit<ComponentProps<typeof EmptyCard>, "placement">;

/** A list under page controls: skeleton while loading, Retry when failed, `blank` when empty, else
 * search, rows or `nothing`. `testID` prefixes `-skeleton`, `-failed`, `-retry`, `-list`, `-heading`. */
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
  /** What closes the list, 16 pt under its last row. */
  footer?: ReactNode;
  data: readonly T[];
  keyExtractor: (row: T) => string;
  renderItem: ComponentProps<typeof FlatList<T>>["renderItem"];
  onEndReached?: () => void;
}) {
  const text = useText();

  if (failed) {
    return (
      <Gap>
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
      </Gap>
    );
  }

  if (loading) {
    return (
      <View testID={`${testID}-skeleton`}>
        <PageControls>
          <SheetFieldSkeleton />
        </PageControls>
        <Gap>
          <CountCardSkeleton />
        </Gap>
      </View>
    );
  }

  if (blank) {
    return (
      <Gap>
        <EmptyCard placement="screen" {...blank} />
      </Gap>
    );
  }

  const header = (
    <>
      <PageControls>
        <SearchFilterRow {...search} />
        {above}
      </PageControls>
      <Gap>
        {heading === undefined ? null : (
          <ListHeading testID={heading ? `${testID}-heading` : undefined} title={heading ?? ""} />
        )}
        {nothing ? <EmptyCard placement="screen" {...nothing} /> : null}
      </Gap>
    </>
  );

  return (
    <FlatList
      {...list}
      ListFooterComponent={footer ? <Gap>{footer}</Gap> : undefined}
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

/** What sits under the page controls, 16 pt below them. */
function Gap({ children }: { children: ReactNode }) {
  return <View className="pt-4">{children}</View>;
}
