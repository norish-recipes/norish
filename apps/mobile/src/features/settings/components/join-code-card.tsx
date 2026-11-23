import React, { useSyncExternalStore } from "react";
import { Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useIntl } from "react-intl";

import type { HouseholdAdminSettingsDto } from "@norish/shared/contracts/dto/household";
import { usePlatform } from "@norish/shared-react/platform";
import { useHouseholdMutations } from "@norish/shared-react/reader";

import { useSettingsWrite } from "../hooks/use-settings-write";
import { joinCodeStatus } from "../utils/household-rules";
import { SettingsGroup } from "./settings-group";
import { SettingsRow } from "./settings-row";

const noTick = () => () => undefined;
const nowToTheSecond = () => Math.floor(Date.now() / 1000) * 1000;
const everySecond = (onTick: () => void) => {
  const interval = setInterval(onTick, 1000);

  return () => clearInterval(interval);
};

/** The admin's join code with its countdown, Copy, Share and Regenerate (Generate when none or expired). */
export function JoinCodeCard({ household }: { household: HouseholdAdminSettingsDto }) {
  const intl = useIntl();
  const { toast } = usePlatform();
  const { regenerateJoinCode } = useHouseholdMutations();
  const write = useSettingsWrite();
  const ticking = Boolean(household.joinCode && household.joinCodeExpiresAt);
  const now = useSyncExternalStore(ticking ? everySecond : noTick, nowToTheSecond, nowToTheSecond);
  const status = joinCodeStatus(household, now);
  const code = status.kind === "active" ? household.joinCode : null;
  const t = (id: string, values?: Record<string, number>) =>
    intl.formatMessage({ id: `settings.household.joinCode.${id}` }, values);
  const regenerate = write(() => regenerateJoinCode(household.id));
  const copy = async () => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      toast.show({ severity: "success", title: t("copySuccess") });
    } catch {
      toast.show({ severity: "danger", title: t("copyFailed") });
    }
  };

  return (
    <SettingsGroup title={t("title")}>
      {code ? (
        <>
          <View className="items-center gap-1 px-4 py-4" testID="household-join-code">
            <Text selectable className="text-foreground font-mono text-[28px] tracking-widest">
              {code}
            </Text>
            <Text className="text-muted text-sm">
              {t("expiresIn")}{" "}
              {status.kind === "active"
                ? t("countdown", { minutes: status.minutes, seconds: status.seconds })
                : ""}
            </Text>
          </View>
          <SettingsRow
            icon="copy-outline"
            testID="household-copy-code"
            title={t("copyButton")}
            onPress={() => void copy()}
          />
          <SettingsRow
            icon="share-outline"
            testID="household-share-code"
            title={intl.formatMessage({ id: "recipes.actions.share" })}
            onPress={() => void Share.share({ message: code })}
          />
          <SettingsRow
            write
            icon="refresh-outline"
            testID="household-regenerate-code"
            title={t("regenerateButton")}
            onPress={regenerate}
          />
        </>
      ) : (
        <SettingsRow
          write
          icon="refresh-outline"
          subtitle={status.kind === "expired" ? t("expired") : t("noCodeDescription")}
          testID="household-generate-code"
          title={t("generateButton")}
          onPress={regenerate}
        />
      )}
    </SettingsGroup>
  );
}
