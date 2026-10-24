import "@/styles/globals.css";

import RegisterServiceWorker from "@/components/register-service-worker";
import { TIME_ZONE_COOKIE } from "@/lib/reader-today";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { BASE_PATH } from "@norish/shared/lib/base-path";

import { appMetadata, appViewport } from "./metadata";
import { AppThemeProvider } from "./providers/theme-provider";

// Signing in or up ends in a full page load, a cross-document view transition. This types it
// `sign-in` for styles/globals.css and skips every other cross-document one.
const SIGN_IN_REVEAL = `addEventListener("pagereveal", (event) => {
  if (!event.viewTransition) return;
  const from = window.navigation?.activation?.from?.url;
  const isAuth = (url) =>
    ["login", "signup"].includes(new URL(url).pathname.slice(${BASE_PATH.length}).split("/")[1]);
  if (from && isAuth(from) && !isAuth(location.href)) event.viewTransition.types.add("sign-in");
  else event.viewTransition.skipTransition();
});`;

// The reader's time zone, for the server to seed date ranges with (lib/reader-today-server.ts).
const TIME_ZONE_COOKIE_WRITE = `try {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (zone && !document.cookie.split("; ").includes("${TIME_ZONE_COOKIE}=" + zone))
    document.cookie = "${TIME_ZONE_COOKIE}=" + zone + "; path=/; max-age=31536000; SameSite=Lax";
} catch {}`;

export const metadata = appMetadata;
export const viewport = appViewport;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  // The settings tabs' messages ship with that route's own provider; other pages keep what
  // their client code reads (the ingredient panels, the AI key prompt).
  const { settings, ...messages } = await getMessages();
  const clientMessages = {
    ...messages,
    settings: {
      ingredients: settings.ingredients,
      admin: { aiProcessing: settings.admin.aiProcessing },
    },
  };

  return (
    <html suppressHydrationWarning lang={locale}>
      <head>
        <meta content="yes" name="apple-mobile-web-app-capable" />
        {/* In the head, so it listens before the page's first render. */}
        <script
          // A constant, and React escapes a script's text children, so it goes in as raw HTML.
          // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
          dangerouslySetInnerHTML={{ __html: `${TIME_ZONE_COOKIE_WRITE}\n${SIGN_IN_REVEAL}` }}
        />
      </head>
      <body className="bg-background text-foreground min-h-dvh font-sans antialiased">
        <AppThemeProvider>
          <NextIntlClientProvider locale={locale} messages={clientMessages}>
            {children}
          </NextIntlClientProvider>
        </AppThemeProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
