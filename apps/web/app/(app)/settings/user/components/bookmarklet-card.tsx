"use client";

import { useRef, useSyncExternalStore } from "react";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { buildBookmarklet } from "@/lib/import-link";
import { ClipboardDocumentIcon } from "@heroicons/react/16/solid";
import { BookmarkIcon } from "@heroicons/react/24/outline";
import { Button, Input, TextField, toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { addBasePath } from "@norish/shared/lib/base-path";

const subscribeToNothing = () => () => {};

function readBookmarklet(): string {
  return buildBookmarklet(`${window.location.origin}${addBasePath("/import")}`);
}

export default function BookmarkletCard() {
  const t = useTranslations("settings.user.bookmarklet");
  const inputRef = useRef<HTMLInputElement>(null);
  // Only the browser knows the address this Norish is reached at.
  const bookmarklet = useSyncExternalStore(subscribeToNothing, readBookmarklet, () => "");

  // A plain-HTTP Norish has no clipboard API, so the code is selected for
  // Cmd+C instead.
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      toast(t("copied"), { variant: "success" });
    } catch {
      inputRef.current?.select();
    }
  }

  return (
    <SettingsCard description={t("description")} icon={BookmarkIcon} title={t("title")}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* React refuses a javascript: href, so the ref swaps it in on the element itself. */}
          <a
            ref={(element) => {
              if (bookmarklet) element?.setAttribute("href", bookmarklet);
            }}
            className="bg-accent text-accent-foreground inline-flex cursor-grab rounded-full px-4 py-2 text-sm font-medium"
            draggable
            href={addBasePath("/import")}
            onClick={(event) => event.preventDefault()}
          >
            {t("linkLabel")}
          </a>
          <span className="text-muted text-sm">{t("dragHint")}</span>
        </div>
        <p className="text-muted text-sm">{t("manualHint")}</p>
        <div className="flex items-center gap-2">
          <TextField fullWidth aria-label={t("linkLabel")} isReadOnly value={bookmarklet}>
            <Input ref={inputRef} fullWidth className="font-mono text-xs" variant="secondary" />
          </TextField>
          <Button className="shrink-0" variant="secondary" onPress={handleCopy}>
            <ClipboardDocumentIcon className="h-4 w-4" />
            {t("copy")}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
