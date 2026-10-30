import React from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  // The root layout leaves the settings tabs' messages out of every other page.
  return (
    <NextIntlClientProvider messages={await getMessages()}>
      <div className="mx-auto w-full max-w-6xl pb-4">{children}</div>
    </NextIntlClientProvider>
  );
}
