"use client";

import { Input, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

/** An entry's name; Enter submits it. Read only where the entry is not the reader's to change. */
export function NameField({
  value,
  onChange,
  onSubmit,
  readOnly = false,
  "data-testid": testId,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  readOnly?: boolean;
  "data-testid": string;
}) {
  const t = useTranslations("settings.content");

  return (
    <TextField aria-label={t("panel.name")} isReadOnly={readOnly} value={value} onChange={onChange}>
      <Input
        data-testid={testId}
        variant="secondary"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
    </TextField>
  );
}
