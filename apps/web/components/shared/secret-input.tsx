"use client";

import { useCallback, useState } from "react";
import { usePending } from "@/hooks/use-pending";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/16/solid";
import { Description, InputGroup, Label, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

interface SecretInputProps {
  label: string;
  /**
   * The new secret to save. Empty means "nothing typed", which every caller
   * sends as `undefined` so the server keeps whatever it already stores.
   */
  value: string;
  onValueChange: (value: string) => void;
  /** Whether this field already has a secret stored on the server. */
  isConfigured: boolean;
  /**
   * Fetches the stored secret so it can be shown. Its answer is displayed and
   * never handed to the caller: looking at a key is not editing it. Without it
   * a stored secret is never shown.
   */
  onReveal?: () => Promise<string | null>;
  placeholder?: string;
  description?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  className?: string;
}

/** What a stored-but-unrevealed secret looks like, as placeholder text. */
const STORED_PLACEHOLDER = "••••••••••••";

/**
 * A password field with a show/hide button — nothing more.
 *
 * The field is always typable. An empty field means "keep what is stored",
 * which is exactly what the server does with an omitted secret, so the two
 * agree without the form having to model an editing mode. Revealing fetches
 * the stored secret and shows it; because a revealed secret never reaches
 * `onValueChange`, looking at a key does not leave the form claiming unsaved
 * changes.
 */
export default function SecretInput({
  label,
  value,
  onValueChange,
  isConfigured,
  onReveal,
  placeholder = "Enter value",
  description,
  isDisabled = false,
  isRequired = false,
  className,
}: SecretInputProps) {
  const t = useTranslations("common.secret");
  const [storedSecret, setStoredSecret] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, whileLoading] = usePending();
  const [wasConfigured, setWasConfigured] = useState(isConfigured);

  // A secret that was deleted, or a provider that changed under the form, is no
  // longer the one on screen.
  if (isConfigured !== wasConfigured) {
    setWasConfigured(isConfigured);

    if (!isConfigured) {
      setStoredSecret(null);
      setIsVisible(false);
    }
  }

  // What is typed wins over what is stored; with neither, the field is empty
  // and its placeholder says a value is already saved.
  const hasTypedValue = value !== "";
  const displayValue = hasTypedValue ? value : (storedSecret ?? "");
  const hasSomethingToShow = hasTypedValue || (isConfigured && onReveal !== undefined);

  const handleChange = useCallback(
    (next: string) => {
      // Editing a revealed secret makes it the caller's value, so the reveal
      // stops standing in for it.
      setStoredSecret(null);
      onValueChange(next);
    },
    [onValueChange]
  );

  const handleToggleVisibility = useCallback(async () => {
    if (isVisible) {
      setIsVisible(false);

      return;
    }

    if (!hasTypedValue && isConfigured && storedSecret === null && onReveal) {
      await whileLoading(() => onReveal().then(setStoredSecret));
    }
    setIsVisible(true);
  }, [hasTypedValue, isConfigured, isVisible, onReveal, storedSecret, whileLoading]);

  // Two sentences that have to read as two: a caller's description written
  // without a full stop otherwise runs straight into the hint after it.
  const hint = [description?.trim(), isConfigured ? t("keepsCurrent") : null]
    .filter((part): part is string => !!part)
    .map((part, index, parts) =>
      index < parts.length - 1 && !/[.!?]$/.test(part) ? `${part}.` : part
    )
    .join(" ");

  return (
    <TextField
      className={className}
      isDisabled={isDisabled}
      // A stored secret already satisfies the field; only an empty one is asked for.
      isRequired={isRequired && !isConfigured}
      type={isVisible ? "text" : "password"}
      value={displayValue}
      onChange={handleChange}
    >
      <Label>{label}</Label>
      <InputGroup variant="secondary">
        <InputGroup.Input
          placeholder={isConfigured && !hasTypedValue ? STORED_PLACEHOLDER : placeholder}
        />
        {hasSomethingToShow && (
          <InputGroup.Suffix>
            <button
              aria-label={isVisible ? t("hide") : t("reveal")}
              className="text-muted hover:text-foreground focus:outline-none disabled:opacity-50"
              disabled={isDisabled || isLoading}
              title={isVisible ? t("hide") : t("reveal")}
              type="button"
              onClick={handleToggleVisibility}
            >
              {isVisible ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          </InputGroup.Suffix>
        )}
      </InputGroup>
      {hint && <Description>{hint}</Description>}
    </TextField>
  );
}
