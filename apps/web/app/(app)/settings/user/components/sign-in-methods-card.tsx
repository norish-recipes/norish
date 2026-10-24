"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { ProviderIcon } from "@/app/(auth)/login/components/provider-icon";
import { useTRPC } from "@/app/providers/trpc-provider";
import { FingerPrintIcon, KeyIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button, toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import {
  keepsOfferedSignInMethod,
  LAST_SIGN_IN_METHOD,
  SIGN_IN_METHODS,
} from "@norish/shared/contracts/dto/auth";
import { authClient } from "@norish/shared/lib/auth/client";
import { addBasePath } from "@norish/shared/lib/base-path";

import { useUserSettingsContext } from "../context";
import { ChangePasswordModal } from "./change-password-modal";

type ErrorMessage =
  "usedByAnotherAccount" | "lastMethod" | "signInAgain" | "addFailed" | "removeFailed";

// What a refused add or remove says, by Better Auth's error code; anything else is generic.
const ERROR_MESSAGES: Record<string, ErrorMessage> = {
  account_already_linked_to_different_user: "usedByAnotherAccount",
  [LAST_SIGN_IN_METHOD]: "lastMethod",
  SESSION_NOT_FRESH: "signInAgain",
};

// Better Auth's client answers `{ data, error }` rather than throwing.
async function orThrow(request: Promise<{ error: unknown }>): Promise<void> {
  const { error } = await request;

  if (error) throw error;
}

export default function SignInMethodsCard() {
  const t = useTranslations("settings.user.signInMethods");
  const format = useFormatter();
  const { user } = useUserSettingsContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [changingPassword, setChangingPassword] = useState(false);
  const { data: offered = [] } = useQuery({
    ...trpc.config.authProviders.queryOptions(),
    select: (data) => data.providers,
  });
  const accountsQuery = trpc.user.signInMethods.queryOptions();
  const { data: accounts = [] } = useQuery(accountsQuery);

  const showError = (code: string | undefined, fallback: ErrorMessage) =>
    toast(t(`errors.${ERROR_MESSAGES[code ?? ""] ?? fallback}`), { variant: "danger" });

  // A refused add comes back from the provider as `?error=`; a cancelled one changes nothing.
  const linkError = searchParams.get("error");

  useEffect(() => {
    if (!linkError) return;
    if (linkError !== "access_denied") showError(linkError, "addFailed");

    const params = new URLSearchParams(searchParams);

    params.delete("error");
    params.delete("error_description");
    router.replace(params.size ? `${pathname}?${params}` : pathname);
    // eslint-disable-next-line @eslint-react/exhaustive-deps -- once per returned error
  }, [linkError]);

  const add = useMutation({
    mutationFn: (provider: string) =>
      orThrow(
        authClient.linkSocial({
          provider,
          callbackURL: addBasePath(pathname),
          errorCallbackURL: addBasePath(pathname),
        })
      ),
    onError: (error: { code?: string }) => showError(error.code, "addFailed"),
  });
  const remove = useMutation({
    mutationFn: (accountId: string) => orThrow(authClient.unlinkAccount({ accountId })),
    onError: (error: { code?: string }) => showError(error.code, "removeFailed"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: accountsQuery.queryKey }),
  });

  const offeredIds = new Set(offered.map((provider) => provider.id));
  // A method the server no longer offers keeps its usual name and icon.
  const methods = new Map(
    [...Object.values(SIGN_IN_METHODS), ...offered].map((method) => [method.id, method])
  );
  const methodOf = (providerId: string) =>
    methods.get(providerId) ?? { ...SIGN_IN_METHODS.oidc, name: providerId };
  const nameOf = (providerId: string) =>
    providerId === "credential" ? t("password") : methodOf(providerId).name;
  const addable = offered.filter(
    (provider) =>
      provider.type === "oauth" && !accounts.some((account) => account.providerId === provider.id)
  );

  const hasPassword =
    offeredIds.has("credential") && accounts.some((account) => account.providerId === "credential");

  // With one method on the server there is nothing to add or remove, only a password to change.
  if (offered.length < 2 && !hasPassword) return null;

  return (
    <SettingsCard
      description={offered.length > 1 ? t("description") : undefined}
      icon={FingerPrintIcon}
      title={t("title")}
    >
      <ul className="border-border divide-border divide-y overflow-hidden rounded-xl border">
        {accounts.map((account) => {
          const name = nameOf(account.providerId);
          const offeredNow = offeredIds.has(account.providerId);

          return (
            <li key={account.id} className="flex items-center gap-3 px-4 py-3">
              <span className="bg-surface-secondary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <ProviderIcon icon={methodOf(account.providerId).icon} providerName={name} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{name}</p>
                <p className={`truncate text-sm ${offeredNow ? "text-muted" : "text-warning"}`}>
                  {!offeredNow
                    ? t("unavailable")
                    : account.providerId === "credential"
                      ? user?.email
                      : t("added", {
                          date: format.dateTime(account.createdAt, { dateStyle: "medium" }),
                        })}
                </p>
              </div>
              {offeredNow && account.providerId === "credential" && (
                <Button size="sm" variant="tertiary" onPress={() => setChangingPassword(true)}>
                  <KeyIcon className="size-4" />
                  <span className="max-sm:sr-only">{t("changePassword")}</span>
                </Button>
              )}
              {keepsOfferedSignInMethod(accounts, account.id, offeredIds) && (
                <Button
                  isPending={remove.isPending && remove.variables === account.id}
                  size="sm"
                  variant="tertiary"
                  onPress={() => remove.mutate(account.id)}
                >
                  <TrashIcon className="size-4" />
                  {/* A phone keeps the row's email; the word stays its accessible name. */}
                  <span className="max-sm:sr-only">{t("remove")}</span>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {addable.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-muted text-sm">{t("addAnother")}</p>
          <div className="flex flex-wrap gap-2">
            {addable.map((provider) => (
              <Button
                key={provider.id}
                className="gap-2"
                isPending={add.isPending && add.variables === provider.id}
                variant="tertiary"
                onPress={() => add.mutate(provider.id)}
              >
                <ProviderIcon icon={provider.icon} providerName={provider.name} width={18} />
                {t("addProvider", { provider: provider.name })}
              </Button>
            ))}
          </div>
        </div>
      )}
      <ChangePasswordModal isOpen={changingPassword} onOpenChange={setChangingPassword} />
    </SettingsCard>
  );
}
