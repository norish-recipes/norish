import type { useTranslations } from "next-intl";

export function formatDuration(durationMs: number | null): string {
  if (durationMs === null || durationMs < 0) return "-";
  if (durationMs < 1_000) return `${durationMs}ms`;
  if (durationMs < 60_000) return `${(durationMs / 1_000).toFixed(1)}s`;
  if (durationMs < 3_600_000) {
    const minutes = Math.floor(durationMs / 60_000);
    const seconds = Math.round((durationMs % 60_000) / 1_000);

    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(durationMs / 3_600_000);
  const minutes = Math.round((durationMs % 3_600_000) / 60_000);

  return `${hours}h ${minutes}m`;
}

export function formatTimestamp(epochMs: number | null): string {
  return epochMs ? new Date(epochMs).toLocaleString() : "-";
}

/**
 * Translates a step id's prefix before ":" and appends the suffix ("creating-recipes:2/5");
 * unknown ids render raw.
 */
export function formatStep(
  step: string | null,
  t: ReturnType<typeof useTranslations>
): string | null {
  if (!step) return null;

  const [id, ...rest] = step.split(":");
  const suffix = rest.length > 0 ? ` (${rest.join(":")})` : "";

  if (id && t.has(`steps.${id}`)) {
    return `${t(`steps.${id}`)}${suffix}`;
  }

  return step;
}
