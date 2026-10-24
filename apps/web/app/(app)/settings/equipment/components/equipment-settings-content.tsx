"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { useTRPC } from "@/app/providers/trpc-provider";
import { EquipmentIconsProvider } from "@/components/equipment/equipment-icon";
import { CreateEquipmentPanel, EquipmentPanel } from "@/components/equipment/equipment-panel";
import { ActionButton } from "@/components/shared/action-button";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@heroui/react";
import { keepPreviousData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { EquipmentList } from "./equipment-list";
import { EquipmentSearch } from "./equipment-search";

export default function EquipmentSettingsContent() {
  const t = useTranslations("settings.equipment");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(() => searchParams.get("equipment"));
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const onSearch = useCallback((next: string) => startTransition(() => setSearch(next)), []);

  const { data, isLoading, isFetching, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery(
      trpc.equipment.list.infiniteQueryOptions(
        { search: search || undefined },
        { getNextPageParam: (page) => page.nextCursor, placeholderData: keepPreviousData }
      )
    );

  const items = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data?.pages]);
  const settling = isPending || (isFetching && !isFetchingNextPage);
  const loadMore = useCallback(() => void fetchNextPage({ cancelRefetch: false }), [fetchNextPage]);

  const openItem = useMemo(
    () => (openId ? (items.find((item) => item.id === openId) ?? null) : null),
    [items, openId]
  );

  const refresh = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.equipment.list.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.equipment.get.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.equipment.icons.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.equipment.find.pathKey() }),
      ]),
    [queryClient, trpc]
  );

  return (
    <EquipmentIconsProvider>
      <div className="flex flex-col gap-6">
        <SettingsCard
          actions={
            <ActionButton
              action="add"
              data-testid="equipment-create-open"
              size="sm"
              variant="secondary"
              onPress={() => setCreateOpen(true)}
            >
              {t("addEquipment")}
            </ActionButton>
          }
          description={t("description")}
          icon={WrenchScrewdriverIcon}
          title={t("title")}
        >
          <EquipmentSearch busy={settling} onSearch={onSearch} />

          {isLoading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted py-6 text-center" data-testid="equipment-empty">
              {t("empty")}
            </p>
          ) : (
            <EquipmentList
              hasMore={hasNextPage}
              isFetchingMore={isFetchingNextPage}
              items={items}
              loadMore={loadMore}
              settling={settling}
              onOpen={setOpenId}
            />
          )}
        </SettingsCard>

        <EquipmentPanel
          id={openId}
          item={openItem}
          open={openId !== null}
          onChanged={() => void refresh()}
          onClose={() => setOpenId(null)}
        />

        <CreateEquipmentPanel
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(equipmentId) => {
            void refresh();
            setOpenId(equipmentId);
          }}
        />
      </div>
    </EquipmentIconsProvider>
  );
}
