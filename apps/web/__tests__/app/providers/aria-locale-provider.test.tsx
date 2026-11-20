/**
 * React Aria follows the browser's language for number parsing and dates; the
 * provider hands it the app's locale only on right-to-left pages, for direction.
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

  it("leaves React Aria on the browser's locale on a left-to-right page", () => {
    renderIn("nl");

    expect(screen.getByText(`${navigator.language} ltr`)).toBeInTheDocument();
  });
});
