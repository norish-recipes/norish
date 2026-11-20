/**
 * HeroUI's components read their direction from React Aria, which would follow
 * the browser's language: the provider hands them the app's locale instead.
 */
import { AriaLocaleProvider } from "@/app/providers/aria-locale-provider";
import { useLocale } from "@heroui/react";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import "@testing-library/jest-dom";

function AriaDirection() {
  const { direction, locale } = useLocale();

  return <span>{`${locale} ${direction}`}</span>;
}

function renderIn(locale: string) {
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      <AriaLocaleProvider>
        <AriaDirection />
      </AriaLocaleProvider>
    </NextIntlClientProvider>
  );
}

describe("AriaLocaleProvider", () => {
  it("runs HeroUI right to left on an Arabic page", () => {
    renderIn("ar");

    expect(screen.getByText("ar rtl")).toBeInTheDocument();
  });

  it("keeps HeroUI left to right on an English page", () => {
    renderIn("en");

    expect(screen.getByText("en ltr")).toBeInTheDocument();
  });
});
