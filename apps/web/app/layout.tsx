import "@/styles/globals.css";

import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { appMetadata, appViewport } from "./metadata";

export const metadata = appMetadata;
export const viewport = appViewport;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html suppressHydrationWarning lang={locale}>
      <head>
        <meta content="yes" name="apple-mobile-web-app-capable" />
      </head>
      <body className="bg-background text-foreground min-h-dvh font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
