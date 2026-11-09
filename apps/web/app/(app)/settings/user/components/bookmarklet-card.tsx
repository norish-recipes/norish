"use client";

import { useRef, useSyncExternalStore } from "react";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { useTRPC } from "@/app/providers/trpc-provider";
import { buildBookmarklet } from "@/lib/import-link";
import { ClipboardDocumentIcon } from "@heroicons/react/16/solid";
import { BookmarkIcon } from "@heroicons/react/24/outline";
import { Button, Input, TextField, toast } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { addBasePath } from "@norish/shared/lib/base-path";

const subscribeToNothing = () => () => {};

export default function BookmarkletCard() {
  const t = useTranslations("settings.user.bookmarklet");
  const inputRef = useRef<HTMLInputElement>(null);
  const trpc = useTRPC();
  const { data: code } = useQuery(trpc.user.importLinkCode.queryOptions());
  // Only the browser knows the address this Norish is reached at.
  const origin = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => ""
  );
  const bookmarklet =
    origin && code ? buildBookmarklet(`${origin}${addBasePath("/import")}`, code) : "";

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
            draggable={!!bookmarklet}
            href={addBasePath("/import")}
            onClick={(event) => event.preventDefault()}
          >
            {t("linkLabel")}
          </a>
          <span className="text-muted text-sm">{t("dragHint")}</span>
        </div>
        <p className="text-muted text-sm">{t("manualHint")}</p>
        <div className="flex items-center gap-2">
          <TextField fullWidth isReadOnly aria-label={t("linkLabel")} value={bookmarklet}>
            <Input ref={inputRef} fullWidth className="font-mono text-xs" variant="secondary" />
          </TextField>
          <Button
            className="shrink-0"
            isDisabled={!bookmarklet}
            variant="secondary"
            onPress={handleCopy}
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
            {t("copy")}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
