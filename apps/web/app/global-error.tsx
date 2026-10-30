"use client";

import "@/styles/globals.css";

import { useEffect, useState } from "react";

import type { LocaleCatalogCode } from "@norish/i18n/locales";
import { LOCALE_CATALOG } from "@norish/i18n/locales";
import { loadMessageSection } from "@norish/i18n/messages";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("GlobalError");

type Copy = { title: string; message: string; retry: string };

const CATALOGUE = Object.keys(LOCALE_CATALOG) as LocaleCatalogCode[];
/** Browser languages the catalogue holds under another code. */
const ALIASES: Record<string, LocaleCatalogCode> = {
  de: "de-formal",
  nb: "no",
  nn: "no",
  pt: "pt-BR",
};

/** The catalogue locale closest to the browser's languages, else English. */
function browserLocale(): LocaleCatalogCode {
  for (const tag of navigator.languages) {
    const exact = CATALOGUE.find((code) => code.toLowerCase() === tag.toLowerCase());
    const base = tag.split("-")[0]!.toLowerCase();
    const match = exact ?? ALIASES[base] ?? CATALOGUE.find((code) => code === base);

    if (match) return match;
  }

  return "en";
}

type Loaded = { locale: LocaleCatalogCode; copy: Copy };

/**
 * The catalogue's English copy, shown until the reader's language loads, and
 * in its place when that cannot load: an error this far out is often a lost
 * network or a chunk that will not load, and the page must still read.
 */
const ENGLISH: Loaded = {
  locale: "en",
  copy: {
    title: "Something went wrong.",
    message: "Norish ran into an error on this page.",
    retry: "Try again",
  },
};

async function loadCopy(locale: LocaleCatalogCode): Promise<Loaded | null> {
  const common = await loadMessageSection(locale, "common").catch(() => null);
  const copy = common?.errorPage as Copy | undefined;

  return copy ? { locale, copy } : null;
}

/**
 * The error boundary of the root layout itself. It replaces the whole
 * document, so the root layout's locale and message provider are gone: the
 * copy comes from the catalogue by the browser's language, in English until
 * then and where it cannot.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [loaded, setLoaded] = useState(ENGLISH);

  useEffect(() => {
    log.error(
      {
        err: error.message,
        name: error.name,
        digest: error.digest,
        stack: error.stack,
      },
      "Unhandled error in the root layout"
    );
  }, [error]);

  useEffect(() => {
    const locale = browserLocale();

    if (locale === "en") return;

    void loadCopy(locale).then((found) => {
      if (found) setLoaded(found);
    });
  }, []);

  return (
    <html lang={loaded.locale}>
      <body className="bg-background text-foreground flex min-h-dvh items-center justify-center p-6 font-sans antialiased">
        <main className="flex max-w-md flex-col items-center gap-3 text-center">
          <h1 className="text-xl font-semibold">{loaded.copy.title}</h1>
          <p className="text-muted text-sm">{loaded.copy.message}</p>
          <button
            className="bg-accent text-accent-foreground mt-2 rounded-lg px-6 py-2 font-medium"
            type="button"
            onClick={() => retry()}
          >
            {loaded.copy.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
