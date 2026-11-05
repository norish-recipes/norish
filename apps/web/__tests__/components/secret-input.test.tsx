import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import SecretInput from "@/components/shared/secret-input";

import common from "@norish/i18n/messages/en/common.json";

function renderField(props: Partial<Parameters<typeof SecretInput>[0]> = {}) {
  const onClear = vi.fn();
  const onValueChange = vi.fn();

  render(
    <NextIntlClientProvider locale="en" messages={{ common }}>
      <SecretInput
        isConfigured
        label="API key"
        value=""
        onClear={onClear}
        onReveal={async () => "stored-key"}
        onValueChange={onValueChange}
        {...props}
      />
    </NextIntlClientProvider>
  );

  return { onClear, onValueChange };
}

describe("SecretInput", () => {
  it("offers to remove a stored secret", () => {
    const { onClear } = renderField();

    fireEvent.click(screen.getByRole("button", { name: "Remove saved value" }));

    expect(onClear).toHaveBeenCalledOnce();
  });

  it("removes the secret when a revealed one is deleted from the field", async () => {
    const { onClear, onValueChange } = renderField();

    fireEvent.click(screen.getByRole("button", { name: "Reveal secret" }));
    const field = screen.getByLabelText("API key");

    await waitFor(() => expect(field).toHaveValue("stored-key"));
    fireEvent.change(field, { target: { value: "" } });

    expect(onClear).toHaveBeenCalledOnce();
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  it.each([
    ["no secret is stored", { isConfigured: false }],
    ["a new one is being typed", { value: "new-key" }],
    ["the form has nothing to fall back to", { onClear: undefined }],
  ])("offers no removal when %s", (_case, props) => {
    renderField(props);

    expect(screen.queryByRole("button", { name: "Remove saved value" })).not.toBeInTheDocument();
  });
});
