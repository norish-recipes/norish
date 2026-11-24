import React, { useState } from "react";
import { ProviderIcon } from "@/components/provider-icon";
import { useAuthClient } from "@/lib/auth/use-auth-client";
import { useText } from "@/lib/i18n/use-text";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { SignInMethodError } from "@norish/shared/contracts/dto/auth";
import { useAuthProvidersQuery } from "@norish/shared-react/config";
import { usePlatform } from "@norish/shared-react/platform";
import { useProfileQuery, useSignInMethodsQuery } from "@norish/shared-react/reader";
import {
  addableProviders,
  hasPassword,
  keepsOfferedSignInMethod,
  showsSignInMethods,
  SIGN_IN_METHODS,
  signInMethodError,
} from "@norish/shared/contracts/dto/auth";

import type { Refusal } from "../utils/refusal-of";
import { readState } from "../utils/read-state";
import { refusalOf } from "../utils/refusal-of";
import { settingsWrite } from "../utils/settings-write";
import { ReadBody } from "./read-body";
import { SettingsGroup } from "./settings-group";
import { SettingsRow } from "./settings-row";

/** The account's sign-in methods: unlink by swipe or long-press, link through the system auth
 * session, and the password sheet. Nothing here is Queued: every call needs the server. */
export function SignInMethods() {
  const intl = useIntl();
  const text = useText();
  const router = useRouter();
  const authClient = useAuthClient();
  const { toast } = usePlatform();
  const [foreground] = useThemeColor(["foreground"] as const);
  const { user } = useProfileQuery();
  const { providers: offered, hasData: providersRead, ...providers } = useAuthProvidersQuery();
  const { signInMethods, refetch, ...read } = useSignInMethodsQuery();
  const [busy, setBusy] = useState(false);

  const offeredIds = new Set(offered.map((provider) => provider.id));
  const passwordOffered = hasPassword(signInMethods, offeredIds);
  const bothRead = read.answered && providersRead;
  const state = readState({
    held: bothRead,
    answered: bothRead,
    isLoading: read.isLoading || providers.isLoading,
    error: read.error ?? providers.error,
  });
  const retry = () => {
    void refetch();
    if (!providersRead) void providers.refetch();
  };

  // The read state decides first; only a read provider list can say the server never shows it.
  if (
    providersRead &&
    !showsSignInMethods(offered.length, offeredIds.has(SIGN_IN_METHODS.credential.id))
  )
    return null;
  if (state === "held" && !showsSignInMethods(offered.length, passwordOffered)) return null;

  // A method the server no longer offers keeps its usual name and icon.
  const methods = new Map(
    [...Object.values(SIGN_IN_METHODS), ...offered].map((method) => [method.id, method])
  );
  const methodOf = (providerId: string) =>
    methods.get(providerId) ?? { ...SIGN_IN_METHODS.oidc, name: providerId };
  const addable = addableProviders(offered, signInMethods);

  // Runs one auth-client call, toasting its refusal and rereading the list after it.
  const callAuthClient = async (
    call: (client: NonNullable<typeof authClient>) => Promise<{ error: Refusal }>,
    fallback: SignInMethodError
  ) => {
    if (!authClient || busy) return;

    setBusy(true);

    const refusal = await refusalOf(call(authClient));

    if (refusal) {
      toast.show({
        severity: "danger",
        title: text(
          `settings.user.signInMethods.errors.${signInMethodError(refusal.code, fallback)}`
        ),
      });
    }

    await refetch();
    setBusy(false);
  };

  const link = (providerId: string) =>
    callAuthClient(
      (client) =>
        // The Expo client opens the system auth session itself, as the sign-in does.
        client.linkSocial({
          provider: providerId,
          callbackURL: "/settings/profile",
          errorCallbackURL: "/settings/profile",
        }),
      "addFailed"
    );
  const unlink = (accountId: string) =>
    callAuthClient((client) => client.unlinkAccount({ accountId }), "removeFailed");

  return (
    <ReadBody empty={null} name="settings-profile-sign-in-methods" state={state} onRetry={retry}>
      <SettingsGroup
        testID="settings-profile-sign-in-methods"
        title={text("settings.user.signInMethods.title")}
      >
        {signInMethods.map((account) => {
          const method = methodOf(account.providerId);
          const isPassword = account.providerId === SIGN_IN_METHODS.credential.id;
          const stillOffered = offeredIds.has(account.providerId);
          const name = isPassword ? text("settings.user.signInMethods.password") : method.name;

          return (
            <SettingsRow
              key={account.id}
              accessory={isPassword && stillOffered ? "chevron" : "none"}
              actions={
                keepsOfferedSignInMethod(signInMethods, account.id, offeredIds)
                  ? [
                      {
                        kind: "unlink",
                        label: text("settings.user.signInMethods.remove"),
                        onPress: settingsWrite(() => void unlink(account.id)),
                      },
                    ]
                  : []
              }
              icon={<ProviderIcon color={foreground} icon={method.icon} size={17} />}
              subtitle={
                !stillOffered
                  ? text("settings.user.signInMethods.unavailable")
                  : isPassword
                    ? user?.email
                    : text("settings.user.signInMethods.added", {
                        date: intl.formatDate(account.createdAt, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }),
                      })
              }
              testID={`settings-profile-sign-in-method-${account.providerId}`}
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
        <SettingsGroup title={text("settings.user.signInMethods.addAnother")}>
          {addable.map((provider) => (
            <SettingsRow
              key={provider.id}
              accessory="external"
              icon={<ProviderIcon color={foreground} icon={provider.icon} size={17} />}
              testID={`settings-profile-sign-in-link-${provider.id}`}
              title={text("settings.user.signInMethods.addProvider", { provider: provider.name })}
              write
              onPress={busy ? undefined : settingsWrite(() => void link(provider.id))}
            />
          ))}
        </SettingsGroup>
      ) : null}
    </ReadBody>
  );
}
