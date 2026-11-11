import React from "react";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { readRequestProfile } from "@/lib/request-profile";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [{ identity }, messages, t] = await Promise.all([
    readRequestProfile(),
    getMessages(),
    getTranslations("settings.page"),
  ]);

  // The root layout leaves the settings tabs' messages out of every other page. Hiding the
  // admin tab is presentation only: admin procedures authorise server-side.
  return (
    <NextIntlClientProvider messages={messages}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex flex-col gap-2">
          <SettingsTabs showAdminTab={identity?.isServerAdmin ?? false} />
          <div className="py-4">{children}</div>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
