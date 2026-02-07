"use client";

import { useState, useCallback, useEffect } from "react";
import { Input, Button, Chip } from "@heroui/react";
import { EyeIcon, EyeSlashIcon, PencilIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

interface SecretInputProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  isConfigured: boolean;
  onReveal: () => Promise<string | null>;
  placeholder?: string;
  description?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  className?: string;
}

const PLACEHOLDER_BULLETS = "••••••••••••";

/**
 * A password/secret input that shows placeholder bullets when configured but not revealed.
 *
 * States:
 * 1. Not configured: Empty input, user can type
 * 2. Configured, not revealed: Shows bullets placeholder with "(configured)" label, eye button to reveal
 * 3. Configured, revealed: Shows actual value, eye-slash button to hide
 * 4. Editing mode: User cleared the field to enter new value
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
  const tActions = useTranslations("common.actions");
  const [isRevealed, setIsRevealed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Reset states when isConfigured changes (e.g., after save/delete)
  useEffect(() => {
    if (!isConfigured) {
      setIsRevealed(false);
      setIsEditing(false);
    }
  }, [isConfigured]);

  const handleReveal = useCallback(async () => {
    setIsLoading(true);
    try {
      const secret = await onReveal();

      if (secret) {
        onValueChange(secret);
        setIsRevealed(true);
        setIsEditing(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [onReveal, onValueChange]);

  const handleHide = useCallback(() => {
    setIsRevealed(false);
    // Clear the value when hiding to prevent accidental saves
    if (!isEditing) {
      onValueChange("");
    }
  }, [isEditing, onValueChange]);

  const handleStartEditing = useCallback(async () => {
    const secret = await onReveal();

    setIsEditing(true);
    setIsRevealed(false);
    onValueChange(secret ?? "");
  }, [onValueChange, onReveal]);

  const handleCancelEditing = useCallback(() => {
    setIsEditing(false);
    onValueChange("");
  }, [onValueChange]);

  // Determine display state
  const showPlaceholderBullets = isConfigured && !isRevealed && !isEditing && !value;
  const showRealValue = isRevealed || isEditing || (!isConfigured && value);
  // Input should be read-only when showing placeholder OR when revealed (but not editing)
  const isInputReadOnly = showPlaceholderBullets || (isRevealed && !isEditing);

  // Enhanced label with "configured" indicator
  const enhancedLabel = (
    <span className="flex items-center gap-2">
      {label}
      {isConfigured && !isEditing && (
        <Chip className="h-5" color="success" size="sm" variant="flat">
          configured
        </Chip>
      )}
      {isEditing && (
        <Chip className="h-5" color="warning" size="sm" variant="flat">
          editing
        </Chip>
      )}
    </span>
  );

  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      <Input
        className="flex-1"
        classNames={{
          input: showPlaceholderBullets ? "text-default-400" : undefined,
        }}
        description={description}
        isDisabled={isDisabled || isInputReadOnly}
        isReadOnly={isInputReadOnly}
        isRequired={isRequired && !isConfigured}
        label={enhancedLabel}
        placeholder={isConfigured && !isEditing ? "" : placeholder}
        type={showRealValue ? "text" : "password"}
        value={showPlaceholderBullets ? PLACEHOLDER_BULLETS : value}
        onValueChange={(v) => {
          // If user starts typing while showing placeholder, switch to editing mode
          if (showPlaceholderBullets && v !== PLACEHOLDER_BULLETS) {
            setIsEditing(true);
            onValueChange(v.replace(PLACEHOLDER_BULLETS, ""));
          } else {
            onValueChange(v);
          }
        }}
      />

      <div className="flex gap-1 pb-0.5">
        {/* Reveal button - show when configured but not revealed/editing */}
        {isConfigured && !isRevealed && !isEditing && (
          <Button
            isIconOnly
            className="h-15"
            isDisabled={isDisabled}
            isLoading={isLoading}
            size="md"
            title={tActions("revealSecret")}
            variant="flat"
            onPress={handleReveal}
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
        )}

        {/* Hide button - show when revealed */}
        {isRevealed && (
          <Button
            isIconOnly
            className="h-15"
            isDisabled={isDisabled}
            size="md"
            title={tActions("hideSecret")}
            variant="flat"
            onPress={handleHide}
          >
            <EyeSlashIcon className="h-4 w-4" />
          </Button>
        )}

        {/* Edit button - show when configured but not editing/revealed */}
        {isConfigured && !isEditing && (
          <Button
            isIconOnly
            className="h-15"
            isDisabled={isDisabled}
            size="md"
            title={tActions("enterNewValue")}
            variant="flat"
            onPress={handleStartEditing}
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
        )}

        {/* Cancel editing button */}
        {isEditing && (
          <Button
            isIconOnly
            className="h-15"
            color="danger"
            isDisabled={isDisabled}
            size="md"
            title={tActions("cancelEditing")}
            variant="flat"
            onPress={handleCancelEditing}
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
