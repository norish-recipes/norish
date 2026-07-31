"use client";

import { useLocale } from "next-intl";

import { countryDisplayName, countryFlagEmoji } from "@norish/shared/lib/recipe-provenance";

interface OriginFlagProps {
  /** ISO-3166-1 alpha-2, as stored. Anything else renders nothing. */
  originCountry: string | null | undefined;
  /** Tailwind size class; the flag scales with whatever it introduces. */
  className?: string;
}

/**
 * A recipe's origin country as its flag.
 *
 * Decorative on purpose. Wherever this appears the country is either named
 * beside it or is incidental to the thing being labelled, so announcing it
 * would either say the country twice or push a country into the accessible
 * name of a title a reader navigates by. The tooltip carries the country's
 * name, in the reader's language, for anyone who does not recognise the flag.
 *
 * Renders nothing at all for a missing or malformed code, so a caller can pass
 * whatever it has without guarding first.
 */
export default function OriginFlag({ originCountry, className }: OriginFlagProps) {
  const locale = useLocale();
  const flag = countryFlagEmoji(originCountry);

  if (!flag) return null;

  return (
    <span
      aria-hidden="true"
      className={className}
      title={countryDisplayName(originCountry, locale) ?? undefined}
    >
      {flag}
    </span>
  );
}
