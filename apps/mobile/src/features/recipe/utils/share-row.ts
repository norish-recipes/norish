type ShareDates = {
  status: "active" | "expired" | "revoked";
  expiresAt: Date | null;
  lastAccessedAt: Date | null;
};

/** What a link row says under its URL: when it ends or ended, and when it was last opened. */
export function shareSubtitle(
  share: ShareDates,
  t: (id: string, values?: Record<string, string>) => string,
  formatDate: (date: Date) => string
): string {
  const ends =
    share.status === "expired" && share.expiresAt
      ? t("expiredOn", { date: formatDate(share.expiresAt) })
      : share.status === "revoked"
        ? null
        : share.expiresAt
          ? t("expiresOn", { date: formatDate(share.expiresAt) })
          : t("neverExpires");
  const opened = share.lastAccessedAt
    ? t("lastOpenedOn", { date: formatDate(share.lastAccessedAt) })
    : null;

  return [ends, opened].filter(Boolean).join(" · ");
}
