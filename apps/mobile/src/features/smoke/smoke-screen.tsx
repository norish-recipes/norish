import React from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRecipesQuery } from "@/hooks/recipes";
import { useUserContext } from "@/lib/auth/user-context";
import { offlineEngine } from "@/lib/offline/engine";
import { Button, Checkbox } from "heroui-native";
import { useIntl } from "react-intl";

import {
  useGroceriesMutations,
  useGroceriesQuery,
  useGroceriesSubscription,
} from "@norish/shared-react/groceries";
import { useOfflineStatus } from "@norish/shared-react/offline/react";
import { useTRPC } from "@norish/shared-react/trpc";

// Throwaway screen that proves sign-in, tRPC, realtime and offline end to end
// until the redesigned screens replace it.
export function SmokeScreen() {
  const intl = useIntl();
  const { user, signOut } = useUserContext();
  const { total, isLoading: recipesLoading } = useRecipesQuery({ limit: 1 });
  const { groceries } = useGroceriesQuery();
  const { toggleGroceries, toggleRecurringGrocery } = useGroceriesMutations();
  const { isLive, outbox, isSyncing, syncNow, retryAll, discardAll } = useOfflineStatus(
    offlineEngine,
    useTRPC()
  );

  useGroceriesSubscription();

  const t = (id: string, values?: Record<string, number>) =>
    intl.formatMessage({ id: `common.offlineStatus.${id}` }, values);

  const confirmDiscard = () =>
    Alert.alert(t("outbox.discardAll"), t("outbox.discardConfirmBody", { count: outbox.total }), [
      { text: t("outbox.discardCancel"), style: "cancel" },
      { text: t("outbox.discardConfirm"), style: "destructive", onPress: () => void discardAll() },
    ]);

  // Unsynced work is only discarded once the user says so (ADR-0009).
  const handleSignOut = async () => {
    const unsynced = await offlineEngine.unsyncedChanges();

    if (unsynced === 0) {
      await signOut();

      return;
    }

    Alert.alert(
      intl.formatMessage({ id: "navbar.userMenu.signOutConfirm.title" }),
      intl.formatMessage({ id: "navbar.userMenu.signOutConfirm.description" }, { count: unsynced }),
      [
        { text: intl.formatMessage({ id: "common.actions.cancel" }), style: "cancel" },
        {
          text: intl.formatMessage({ id: "navbar.userMenu.logout" }),
          style: "destructive",
          onPress: () => void signOut({ discardQueue: true }),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Text className="font-normal" testID="smoke-user">
          {user ? `${user.name} <${user.email}>` : "No user"}
        </Text>
        <Text className="font-normal" testID="smoke-connection">
          {t(isLive ? "connection.live" : "connection.offline")}
        </Text>
        <Text className="font-normal" testID="smoke-recipe-count">
          {recipesLoading ? "Recipes: …" : `Recipes: ${total}`}
        </Text>
        <Text className="font-normal">Groceries</Text>
        {groceries.map((grocery) => (
          <View key={grocery.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Checkbox
              accessibilityLabel={grocery.name ?? undefined}
              isSelected={grocery.isDone}
              testID={`smoke-grocery-${grocery.id}`}
              onSelectedChange={(isDone) =>
                grocery.recurringGroceryId
                  ? toggleRecurringGrocery(grocery.recurringGroceryId, grocery.id, isDone)
                  : toggleGroceries([grocery.id], isDone)
              }
            />
            <Text className="font-normal">{grocery.name}</Text>
          </View>
        ))}
        <Text className="font-normal">{t("outbox.heading")}</Text>
        <Text className="font-normal" testID="smoke-outbox">
          {outbox.total === 0
            ? t("outbox.empty")
            : t(isSyncing ? "outbox.syncing" : "outbox.pending", { count: outbox.pending })}
        </Text>
        {outbox.entries.map((entry) => (
          <Text key={entry.seq} className="font-normal" testID={`smoke-outbox-${entry.status}`}>
            {[entry.path, t(`outbox.status.${entry.status}`), entry.parkedReason]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        ))}
        <Button isDisabled={isSyncing} variant="secondary" onPress={() => void syncNow()}>
          <Button.Label>{t("outbox.syncNow")}</Button.Label>
        </Button>
        {outbox.parked + outbox.conflicted > 0 ? (
          <Button variant="secondary" onPress={() => void retryAll()}>
            <Button.Label>{t("outbox.retryAll")}</Button.Label>
          </Button>
        ) : null}
        {outbox.total > 0 ? (
          <Button variant="secondary" onPress={confirmDiscard}>
            <Button.Label>{t("outbox.discardAll")}</Button.Label>
          </Button>
        ) : null}
        <Button testID="smoke-sign-out" variant="secondary" onPress={() => void handleSignOut()}>
          <Button.Label>Sign out</Button.Label>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
