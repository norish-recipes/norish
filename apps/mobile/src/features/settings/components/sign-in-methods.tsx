import React, { useState } from "react";
import { View } from "react-native";
import { ProviderIcon } from "@/components/provider-icon";
import { useAuthClient } from "@/lib/auth/use-auth-client";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useAuthProvidersQuery } from "@norish/shared-react/config";
import { usePlatform } from "@norish/shared-react/platform";
import { useProfileQuery, useSignInMethodsQuery } from "@norish/shared-react/reader";
import { SIGN_IN_METHODS } from "@norish/shared/contracts/dto/auth";

import {
  addableProviders,
  canUnlink,
  hasPassword,
  showsSignInMethods,
  signInMethodErrorKey,
} from "../utils/profile-rules";
import { SettingsGroup } from "./settings-group";
import { SettingsRow } from "./settings-row";

type Refusal = { code?: string } | null;

/** The account's sign-in methods: unlink by swipe or long-press, link through the system auth
 * session, and the password sheet. Nothing here is Queued: every call needs the server. */
export function SignInMethods() {
  const intl = useIntl();
  const router = useRouter();
  const authClient = useAuthClient();
  const { toast } = usePlatform();
  const [foreground] = useThemeColor(["foreground"] as const);
  const { user } = useProfileQuery();
  const { providers: offered } = useAuthProvidersQuery();
  const { signInMethods, refetch } = useSignInMethodsQuery();
  const [busy, setBusy] = useState(false);
  const t = (id: string, values?: Record<string, string>) =>
    intl.formatMessage({ id: `settings.user.signInMethods.${id}` }, values);

  const offeredIds = new Set(offered.map((provider) => provider.id));
  const passwordOffered = hasPassword(signInMethods, offeredIds);

  if (!showsSignInMethods(offered.length, passwordOffered)) return null;

  // A method the server no longer offers keeps its usual name and icon.
  const methods = new Map(
    [...Object.values(SIGN_IN_METHODS), ...offered].map((method) => [method.id, method])
  );
  const methodOf = (providerId: string) =>
    methods.get(providerId) ?? { ...SIGN_IN_METHODS.oidc, name: providerId };
  const addable = addableProviders(offered, signInMethods);

  // Better Auth answers `{ error }` rather than throwing; a thrown call reads as a failure too.
  const run = async (
    call: () => Promise<{ error: Refusal }>,
    fallback: "addFailed" | "removeFailed"
  ) => {
    if (!authClient || busy) return;

    setBusy(true);

    const { error } = await call().catch((): { error: Refusal } => ({ error: {} }));

    if (error) {
      toast.show({
        severity: "danger",
        title: intl.formatMessage({ id: signInMethodErrorKey(error.code, fallback) }),
      });
    }

    await refetch();
    setBusy(false);
  };

  const link = (providerId: string) =>
    run(
      () =>
        // The Expo client opens the system auth session itself, as the sign-in does.
        authClient!.linkSocial({
          provider: providerId,
          callbackURL: "/settings/profile",
          errorCallbackURL: "/settings/profile",
        }),
      "addFailed"
    );
  const unlink = (accountId: string) =>
    run(() => authClient!.unlinkAccount({ accountId }), "removeFailed");

  return (
    <>
      <SettingsGroup testID="sign-in-methods" title={t("title")}>
        {signInMethods.map((account) => {
          const method = methodOf(account.providerId);
          const isPassword = account.providerId === "credential";
          const stillOffered = offeredIds.has(account.providerId);
          const name = isPassword ? t("password") : method.name;

          return (
            <SettingsRow
              key={account.id}
              accessory={isPassword && stillOffered ? "chevron" : "none"}
              actions={
                canUnlink(signInMethods, account.id, offeredIds)
                  ? [{ kind: "unlink", label: t("remove"), onPress: () => void unlink(account.id) }]
                  : []
              }
              leading={<MethodTile color={foreground} icon={method.icon} />}
              subtitle={
                !stillOffered
                  ? t("unavailable")
                  : isPassword
                    ? user?.email
                    : t("added", {
                        date: intl.formatDate(account.createdAt, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }),
                      })
              }
              testID={`sign-in-method-${account.providerId}`}
              title={name}
              write={isPassword}
              onPress={
                isPassword && stillOffered ? () => router.push("/settings/password") : undefined
              }
            />
          );
        })}
      </SettingsGroup>
      {addable.length > 0 ? (
        <SettingsGroup title={t("addAnother")}>
          {addable.map((provider) => (
            <SettingsRow
              key={provider.id}
              accessory="external"
              leading={<MethodTile color={foreground} icon={provider.icon} />}
              testID={`sign-in-link-${provider.id}`}
              title={t("addProvider", { provider: provider.name })}
              write
              onPress={busy ? undefined : () => void link(provider.id)}
            />
          ))}
        </SettingsGroup>
      ) : null}
    </>
  );
}

function MethodTile({ icon, color }: { icon: string; color: string }) {
  return (
    <View className="bg-default size-[30px] items-center justify-center rounded-[9px]">
      <ProviderIcon color={color} icon={icon} size={17} />
    </View>
  );
}
