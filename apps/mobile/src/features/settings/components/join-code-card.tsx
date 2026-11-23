import React, { useSyncExternalStore } from "react";
import { Share, Text, View } from "react-native";
import { useText } from "@/lib/i18n/use-text";
import * as Clipboard from "expo-clipboard";

import type { HouseholdAdminSettingsDto } from "@norish/shared/contracts/dto/household";
import { usePlatform } from "@norish/shared-react/platform";
import {
  everySecondUntil,
  joinCodeStatus,
  noTick,
  nowToTheSecond,
  useHouseholdMutations,
} from "@norish/shared-react/reader";

import { useSettingsWrite } from "../hooks/use-settings-write";
import { SettingsGroup } from "./settings-group";
import { SettingsRow } from "./settings-row";

/** The admin's join code with its countdown, Copy, Share and Regenerate (Generate when none or expired). */
export function JoinCodeCard({ household }: { household: HouseholdAdminSettingsDto }) {
  const text = useText();
  const { toast } = usePlatform();
  const { regenerateJoinCode, pending } = useHouseholdMutations();
  const write = useSettingsWrite();
  const expiresAt =
    household.joinCode && household.joinCodeExpiresAt
      ? new Date(household.joinCodeExpiresAt).getTime()
      : null;
  const now = useSyncExternalStore(
    expiresAt === null ? noTick : everySecondUntil(expiresAt),
    nowToTheSecond,
    nowToTheSecond
  );
  const status = joinCodeStatus(household, now);
  const code = status.kind === "active" ? household.joinCode : null;
  const regenerate = write(() => !pending.regenerate && regenerateJoinCode(household.id));
  const copy = async () => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      toast.show({ severity: "success", title: text("settings.household.joinCode.copySuccess") });
    } catch {
      toast.show({ severity: "danger", title: text("settings.household.joinCode.copyFailed") });
    }
  };

  return (
    <SettingsGroup title={text("settings.household.joinCode.title")}>
      {code ? (
        <>
          <View className="items-center gap-1 px-4 py-4" testID="household-join-code">
            <Text selectable className="text-foreground font-mono text-[28px] tracking-widest">
              {code}
            </Text>
            <Text className="text-muted text-sm">
              {text("settings.household.joinCode.expiresIn")}{" "}
              {status.kind === "active"
                ? text("settings.household.joinCode.countdown", {
                    minutes: status.minutes,
                    seconds: status.seconds,
                  })
                : ""}
            </Text>
          </View>
          <SettingsRow
            icon="copy-outline"
            testID="household-copy-code"
            title={text("settings.household.joinCode.copyButton")}
            onPress={() => void copy()}
          />
          <SettingsRow
            icon="share-outline"
            testID="household-share-code"
            title={text("recipes.actions.share")}
            onPress={() => void Share.share({ message: code })}
          />
          <SettingsRow
            write
            icon="refresh-outline"
            testID="household-regenerate-code"
            title={text("settings.household.joinCode.regenerateButton")}
            onPress={regenerate}
          />
        </>
      ) : (
        <SettingsRow
          write
          icon="refresh-outline"
          subtitle={
            status.kind === "expired"
              ? text("settings.household.joinCode.expired")
              : text("settings.household.joinCode.noCodeDescription")
          }
          testID="household-generate-code"
          title={text("settings.household.joinCode.generateButton")}
          onPress={regenerate}
        />
      )}
    </SettingsGroup>
  );
}
