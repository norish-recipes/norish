import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { LabelWithHint } from "@/components/hint-button";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { Switch } from "@/components/switch";
import { useAuthClient } from "@/lib/auth/use-auth-client";
import { useNavigation, useRouter } from "expo-router";
import { TextField } from "heroui-native";
import { useIntl } from "react-intl";

import { useConnectivity } from "@norish/shared-react/offline/react";
import { usePlatform } from "@norish/shared-react/platform";

import { OfflineCapsule } from "../components/offline-capsule";
import { passwordChecks } from "../utils/profile-rules";
import { refusalOf } from "../utils/refusal-of";
import { settingsWrite } from "../utils/settings-write";

/** The change password sheet, mounted per opening so a closed sheet keeps no password; it stays
 * open while the change is under way. */
export function PasswordScreen() {
  const intl = useIntl();
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
  const t = (id: string) => intl.formatMessage({ id: `settings.user.signInMethods.${id}` });
  const field = (label: string, testID: string, value: string, set: (value: string) => void) => (
    <TextField>
      <SheetInput
        accessibilityLabel={label}
        editable={!isOffline}
        secureTextEntry
        testID={testID}
        value={value}
        onChangeText={set}
      />
    </TextField>
  );
  const error = (message: string) => (
    <Text className="text-danger px-2 pt-1.5 text-[13px]">{message}</Text>
  );

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !sending });
  }, [navigation, sending]);

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
    "password-change"
  );
  const change = async () => {
    setSending(true);
    const refusal = await sendChange();

    setSending(false);
    if (refusal === undefined || !navigation.isFocused()) return;
    if (!refusal) {
      toast.show({ severity: "success", title: t("passwordChanged") });
      router.back();
    } else if (refusal.code === "INVALID_PASSWORD") setWrongPassword(true);
    else toast.show({ severity: "danger", title: t("errors.changeFailed") });
  };

  return (
    <Sheet
      closable={!sending}
      confirm={{
        label: t("changePassword"),
        symbol: "key",
        disabled: !checks.valid || isOffline || sending,
        onPress: () => void change(),
      }}
      name="password"
      title={t("changePassword")}
    >
      <SheetBody contentClassName="gap-4">
        <OfflineCapsule />
        <View>
          <LabelWithHint label={t("currentPassword")} />
          {field(t("currentPassword"), "password-current", current, (value) => {
            setCurrent(value);
            setWrongPassword(false);
          })}
          {wrongPassword ? error(t("errors.wrongPassword")) : null}
        </View>
        <View>
          <LabelWithHint
            hint={intl.formatMessage({ id: "auth.signup.passwordDescription" })}
            label={t("newPassword")}
            testID="password-hint"
          />
          {field(t("newPassword"), "password-new", next, setNext)}
          {checks.tooShort || checks.tooLong
            ? error(
                intl.formatMessage({
                  id: checks.tooLong
                    ? "auth.signup.errors.passwordTooLong"
                    : "auth.signup.errors.passwordTooShort",
                })
              )
            : null}
        </View>
        <View>
          <LabelWithHint label={t("confirmPassword")} />
          {field(t("confirmPassword"), "password-confirm", confirmation, setConfirmation)}
          {checks.mismatch
            ? error(intl.formatMessage({ id: "auth.signup.errors.passwordMismatch" }))
            : null}
        </View>
        <View className="flex-row items-center justify-between px-2">
          <Text className="text-foreground text-base">{t("signOutOthers")}</Text>
          <Switch
            accessibilityLabel={t("signOutOthers")}
            isSelected={revokeOthers}
            testID="password-revoke-others"
            onSelectedChange={setRevokeOthers}
          />
        </View>
      </SheetBody>
    </Sheet>
  );
}
