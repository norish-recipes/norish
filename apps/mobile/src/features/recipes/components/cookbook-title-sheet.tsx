import type { ComponentRef } from "react";
import React from "react";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { useFocusOnMount } from "@/hooks/use-focus-on-mount";
import { Input, Skeleton, TextField } from "heroui-native";
import { useIntl } from "react-intl";

/** A cookbook's title in a sheet as tall as its field: New cookbook and Rename share it. */
export function CookbookTitleSheet({
  name,
  title,
  value,
  submitLabelId,
  canSubmit,
  isLoading = false,
  onChange,
  onSubmit,
}: {
  /** The testID prefix of the sheet and its field. */
  name: string;
  title: string;
  /** Absent while the cookbook loads. */
  value?: string;
  submitLabelId: string;
  canSubmit: boolean;
  /** The cookbook is not read yet: the field is a skeleton, Save disabled, and no handler runs. */
  isLoading?: boolean;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
}) {
  const intl = useIntl();
  const disabled = !canSubmit || isLoading || !onSubmit;
  // The sheet opens on its field, so the keyboard rises with it.
  const fieldRef = useFocusOnMount<ComponentRef<typeof Input>>();

  return (
    <Sheet
      confirm={{
        label: intl.formatMessage({ id: submitLabelId }),
        disabled,
        onPress: onSubmit,
      }}
      name={name}
      title={title}
    >
      <SheetBody>
        {isLoading ? (
          <Skeleton className="h-12 rounded-full" testID={`${name}-title-skeleton`} />
        ) : (
          <TextField>
            <SheetInput
              ref={fieldRef}
              accessibilityLabel={intl.formatMessage({ id: "recipes.cookbooks.titleLabel" })}
              placeholder={intl.formatMessage({ id: "recipes.cookbooks.titlePlaceholder" })}
              returnKeyType="done"
              testID={`${name}-title`}
              value={value}
              onChangeText={onChange}
              onClear={onChange ? () => onChange("") : undefined}
              onSubmitEditing={disabled ? undefined : onSubmit}
            />
          </TextField>
        )}
      </SheetBody>
    </Sheet>
  );
}
