"use client";

import { useEffect, useRef } from "react";
import { useRecipesContext } from "@/context/recipes-context";
import { readClipboardUrl } from "@/lib/clipboard-url";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

/** How long the ask stays up, unless it is being hovered or focused. */
const PROMPT_TIMEOUT_MS = 15_000;
/** The last link this tab asked about, so a dismissed ask is not repeated. */
const OFFERED_STORAGE_KEY = "norish.clipboard-import.offered";

function readOffered(): string | null {
  try {
    return window.sessionStorage.getItem(OFFERED_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberOffered(url: string): void {
  try {
    window.sessionStorage.setItem(OFFERED_STORAGE_KEY, url);
  } catch {}
}

/** A link into this Norish is a page here, not a recipe to import. */
function isOwnLink(url: string): boolean {
  try {
    return new URL(url).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * The ask when a link is on the clipboard: "Import a recipe from the link you
 * copied?" with the link and an Import button, as a toast, on every page of
 * the app.
 *
 * It reads the clipboard when a page opens and whenever the window regains
 * focus, which is the moment someone comes back from copying a link
 * elsewhere. A tab asks about a link once: a dismissed ask is not repeated on
 * the next page or reload, and a fresh link is asked about anew. Import goes
 * through the same import as the URL dialog, which lands on the dashboard
 * where the pending card is, and offline it is Queued in the Outbox like any
 * other change, so there is no reason not to ask. Only a browser that hands
 * the clipboard over without a gesture (Chromium, once permission is given)
 * ever shows it; elsewhere the read is refused and nothing happens, the same
 * deal the URL modal's clipboard prefill makes.
 */
export default function ClipboardImportPrompt() {
  const t = useTranslations("common.import.clipboard");
  const tActions = useTranslations("common.actions");
  const { importRecipe } = useRecipesContext();
  const isReadingRef = useRef(false);

  useEffect(() => {
    let isCancelled = false;

    async function offerClipboardLink() {
      if (isReadingRef.current || !document.hasFocus()) return;
      isReadingRef.current = true;

      try {
        const url = await readClipboardUrl();

        if (isCancelled || !url || isOwnLink(url) || readOffered() === url) return;

        rememberOffered(url);
        const key = toast(t("title"), {
          description: <span className="line-clamp-2 break-all">{url}</span>,
          timeout: PROMPT_TIMEOUT_MS,
          actionProps: {
            children: tActions("import"),
            onPress: () => {
              toast.close(key);
              importRecipe(url);
            },
          },
        });
      } finally {
        isReadingRef.current = false;
      }
    }

    void offerClipboardLink();
    window.addEventListener("focus", offerClipboardLink);

    return () => {
      isCancelled = true;
      window.removeEventListener("focus", offerClipboardLink);
    };
  }, [importRecipe, t, tActions]);

  return null;
}
