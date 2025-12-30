import "@/styles/globals.css";
import { appMetadata, appViewport } from "./metadata";

import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { fontSans } from "@/config/fonts";
import RegisterServiceWorker from "@/components/register-service-worker";

export const metadata = appMetadata;
export const viewport = appViewport;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html suppressHydrationWarning lang={locale}>
      <head>
        <meta content="transparent" name="theme-color" />
      </head>
      <body
        className={`bg-background text-foreground min-h-dvh font-sans antialiased ${fontSans.variable}`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
