import type { ReactNode } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { InputGroup, TextField } from "@heroui/react";

/** The search field of a list: a magnifier, the text, and at the end `suffix` (a filter button). */
export function SearchField({
  label,
  value,
  onChange,
  busy = false,
  suffix,
  "data-testid": testId,
  iconTestId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** The magnifier pulses while the list is being searched. */
  busy?: boolean;
  suffix?: ReactNode;
  "data-testid"?: string;
  iconTestId?: string;
}) {
  return (
    <TextField aria-label={label} className="min-w-0 flex-1" value={value} onChange={onChange}>
      <InputGroup variant="secondary">
        <InputGroup.Prefix className="ps-3">
          <MagnifyingGlassIcon
            aria-hidden
            className={`size-5 ${busy ? "text-accent animate-pulse" : "text-muted"}`}
            data-fetching={iconTestId ? busy : undefined}
            data-testid={iconTestId}
          />
        </InputGroup.Prefix>
        <InputGroup.Input data-testid={testId} placeholder={label} />
        {suffix ? <InputGroup.Suffix className="pe-1">{suffix}</InputGroup.Suffix> : null}
      </InputGroup>
    </TextField>
  );
}
