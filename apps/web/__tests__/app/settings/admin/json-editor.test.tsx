import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import JsonEditor from "@/app/(app)/settings/admin/components/json-editor";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@heroui/react", () => ({
  Textarea: ({ value, onChange, placeholder }: any) => (
    <textarea aria-label="json" placeholder={placeholder} value={value} onChange={onChange} />
  ),
  Button: ({ children, onPress, isDisabled }: any) => (
    <button disabled={!!isDisabled} type="button" onClick={onPress}>
      {children}
    </button>
  ),
}));

describe("JsonEditor", () => {
  it("clears the editor when value becomes undefined", () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });

    const { rerender } = render(
      <JsonEditor description="desc" value={{ foo: "bar" }} onSave={onSave} />
    );

    expect(screen.getByLabelText("json")).toHaveValue('{\n  "foo": "bar"\n}');

    rerender(<JsonEditor description="desc" value={undefined} onSave={onSave} />);

    expect(screen.getByLabelText("json")).toHaveValue("");
  });

  it("keeps restore defaults enabled when editor is disabled", () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });
    const onRestoreDefaults = vi.fn().mockResolvedValue({ success: true });

    render(
      <JsonEditor
        disabled
        description="desc"
        value={{ foo: "bar" }}
        onRestoreDefaults={onRestoreDefaults}
        onSave={onSave}
      />
    );

    expect(screen.getByRole("button", { name: "restoreDefaults" })).toBeEnabled();
  });

  it("calls restore mutation and shows refreshed value", async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });
    const restoreMutation = vi.fn().mockResolvedValue({ success: true });

    function TestHarness() {
      const [value, setValue] = useState<unknown>({ foo: "custom" });

      return (
        <JsonEditor
          description="desc"
          value={value}
          onRestoreDefaults={async () => {
            const result = await restoreMutation();

            if (result.success) {
              setValue({ foo: "default" });
            }

            return result;
          }}
          onSave={onSave}
        />
      );
    }

    render(<TestHarness />);

    expect(screen.getByLabelText("json")).toHaveValue('{\n  "foo": "custom"\n}');

    fireEvent.click(screen.getByRole("button", { name: "restoreDefaults" }));

    await waitFor(() => {
      expect(restoreMutation).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByLabelText("json")).toHaveValue('{\n  "foo": "default"\n}');
    });
  });
});
