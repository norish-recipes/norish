import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { AuthErrorScreen } from "@/features/auth/auth-error-screen";

import auth from "@norish/i18n/messages/en/auth.json";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("error=account_not_linked"),
}));

describe("auth error screen", () => {
  it("says the email is already in use when a provider cannot be linked", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ auth }}>
        <AuthErrorScreen />
      </NextIntlClientProvider>
    );

    expect(await screen.findByText(auth.errors.account_not_linked.description)).toBeInTheDocument();
  });
});
