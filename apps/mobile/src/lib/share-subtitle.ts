type ShareDates = {
  status: "active" | "expired" | "revoked";
  expiresAt: Date | null;
  lastAccessedAt: Date | null;
};

type Text = (id: string, values?: Record<string, string>) => string;

/** When a link that was not revoked ends or ended. */
const endOf = (share: ShareDates, t: Text, formatDate: (date: Date) => string) =>
  share.status === "expired" && share.expiresAt
    ? t("expiredOn", { date: formatDate(share.expiresAt) })
    : share.expiresAt
      ? t("expiresOn", { date: formatDate(share.expiresAt) })
      : t("neverExpires");

/** What a link row says under its URL: when it ends or ended, and when it was last opened. */
export function shareSubtitle(
  share: ShareDates,
  t: Text,
  formatDate: (date: Date) => string
): string {
  const ends = share.status === "revoked" ? null : endOf(share, t, formatDate);
  const opened = share.lastAccessedAt
    ? t("lastOpenedOn", { date: formatDate(share.lastAccessedAt) })
    : null;

  return [ends, opened].filter(Boolean).join(" · ");
}

/** What a Settings link row says: the one date it ends, ended or was revoked on. */
export function shareEnding(
  share: ShareDates & { revokedAt: Date | null },
  t: Text,
  formatDate: (date: Date) => string
): string {
  if (share.status !== "revoked") return endOf(share, t, formatDate);

  return share.revokedAt ? t("revokedOn", { date: formatDate(share.revokedAt) }) : "";
}
