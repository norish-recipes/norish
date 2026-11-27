import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { OfflineCapsule } from "@/components/offline-capsule";
import { Sheet, SheetBody } from "@/components/sheet";
import { Switch } from "@/components/switch";
import { useAuthClient } from "@/lib/auth/use-auth-client";
import { useText } from "@/lib/i18n/use-text";
import { useNavigation, useRouter } from "expo-router";

import { useConnectivity } from "@norish/shared-react/offline/react";
import { usePlatform } from "@norish/shared-react/platform";
import { passwordChecks } from "@norish/shared/lib/auth/password";

import { SettingsField } from "../components/settings-form";
import { refusalOf } from "../utils/refusal-of";
import { DROPPED, settingsWrite, tellWentThroughLate } from "../utils/settings-write";

/** The change password sheet, mounted per opening so a closed sheet keeps no password; it stays
 * open while the change is under way. */
export function PasswordScreen() {
  const text = useText();
  const router = useRouter();
  const navigation = useNavigation();
  const authClient = useAuthClient();
  const { toast } = usePlatform();
  const { isOffline } = useConnectivity();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [wrongPassword, setWrongPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const checks = passwordChecks({ current, next, confirmation });

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !sending });
  }, [navigation, sending]);

  // Closes the sheet while it is in front; a change answered after the release says it went through.
  const changed = (late: boolean) => {
    if (!navigation.isFocused()) return;
    if (late) tellWentThroughLate();
    else
      toast.show({
        severity: "success",
        title: text("settings.user.signInMethods.passwordChanged"),
      });
    router.back();
  };
  const sendChange = settingsWrite(
    () =>
      authClient
        ? refusalOf(
            authClient.changePassword({
              currentPassword: current,
              newPassword: next,
              revokeOtherSessions: revokeOthers,
            })
          )
        : undefined,
    "password-change",
    undefined,
    (late) => {
      if (late === null) changed(true);
    }
  );
  const change = async () => {
    setSending(true);
    const refusal = await sendChange();

    setSending(false);
    if (refusal === undefined || refusal === DROPPED) return;
    if (!refusal) return changed(false);
    if (!navigation.isFocused()) return;
    if (refusal.code === "INVALID_PASSWORD") setWrongPassword(true);
    else
      toast.show({
        severity: "danger",
        title: text("settings.user.signInMethods.errors.changeFailed"),
      });
  };

  return (
    <Sheet
      closable={!sending}
      confirm={{
        label: text("settings.user.signInMethods.changePassword"),
        symbol: "key",
        disabled: !checks.valid || isOffline || sending,
        onPress: () => void change(),
      }}
      name="settings-password"
      title={text("settings.user.signInMethods.changePassword")}
    >
      <SheetBody>
        <OfflineCapsule />
        <SettingsField
          error={wrongPassword ? text("settings.user.signInMethods.errors.wrongPassword") : null}
          label={text("settings.user.signInMethods.currentPassword")}
          secureTextEntry
          testID="settings-password-current"
          value={current}
          onChangeText={(value) => {
            setCurrent(value);
            setWrongPassword(false);
          }}
        />
        <SettingsField
          error={
            checks.tooShort || checks.tooLong
              ? text(
                  checks.tooLong
                    ? "auth.signup.errors.passwordTooLong"
                    : "auth.signup.errors.passwordTooShort"
                )
              : null
          }
          hint={text("auth.signup.passwordDescription")}
          label={text("settings.user.signInMethods.newPassword")}
          secureTextEntry
          testID="settings-password-new"
          value={next}
          onChangeText={setNext}
        />
        <SettingsField
          error={checks.mismatch ? text("auth.signup.errors.passwordMismatch") : null}
          label={text("settings.user.signInMethods.confirmPassword")}
          secureTextEntry
          testID="settings-password-confirm"
          value={confirmation}
          onChangeText={setConfirmation}
        />
        <View className="flex-row items-center justify-between px-2">
          <Text className="text-foreground text-base">
            {text("settings.user.signInMethods.signOutOthers")}
          </Text>
          <Switch
            accessibilityLabel={text("settings.user.signInMethods.signOutOthers")}
            isSelected={revokeOthers}
            testID="settings-password-revoke-others"
            onSelectedChange={setRevokeOthers}
          />
        </View>
      </SheetBody>
    </Sheet>
  );
}
