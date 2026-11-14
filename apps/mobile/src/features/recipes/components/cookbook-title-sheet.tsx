import type { ComponentProps, ComponentRef } from "react";
import React from "react";
import { Sheet, SheetBody } from "@/components/sheet";
import { useFocusOnMount } from "@/hooks/use-focus-on-mount";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Button, Input, Skeleton, TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** A cookbook's title in a sheet as tall as its field: New cookbook and Rename share it. */
export function CookbookTitleSheet({
  name,
  title,
  value,
  submitLabelId,
  submitIcon,
  canSubmit,
  isLoading = false,
  onChange,
  onSubmit,
}: {
  /** The testID prefix of the sheet, its field and its buttons. */
  name: string;
  title: string;
  /** Absent while the cookbook loads. */
  value?: string;
  submitLabelId: string;
  submitIcon: IconName;
  canSubmit: boolean;
  /** The cookbook is not read yet: the field is a skeleton, the action disabled, and no handler runs. */
  isLoading?: boolean;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
}) {
  const intl = useIntl();
  const router = useRouter();
  const [foreground, accentForeground] = useThemeColor([
    "foreground",
    "accent-foreground",
  ] as const);
  const disabled = !canSubmit || isLoading || !onSubmit;
  // The sheet opens on its field, so the keyboard rises with it.
  const fieldRef = useFocusOnMount<ComponentRef<typeof Input>>();

  return (
    <Sheet
      actions={
        <Sheet.Actions>
          <Sheet.Action>
            <Button
              className="h-12"
              testID={`${name}-cancel`}
              variant="tertiary"
              onPress={() => router.back()}
            >
              <Ionicons color={foreground} name="close" size={18} />
              <Button.Label className="font-medium">
                {intl.formatMessage({ id: "common.actions.cancel" })}
              </Button.Label>
            </Button>
          </Sheet.Action>
          <Sheet.Action>
            <Button
              className="h-12"
              isDisabled={disabled}
              testID={`${name}-submit`}
              variant="primary"
              onPress={onSubmit}
            >
              <Ionicons color={accentForeground} name={submitIcon} size={18} />
              <Button.Label className="font-semibold">
                {intl.formatMessage({ id: submitLabelId })}
              </Button.Label>
            </Button>
          </Sheet.Action>
        </Sheet.Actions>
      }
      name={name}
      title={title}
    >
      <SheetBody>
        {isLoading ? (
          <Skeleton className="h-12 rounded-full" testID={`${name}-title-skeleton`} />
        ) : (
          <TextField>
            <Input
              ref={fieldRef}
              accessibilityLabel={intl.formatMessage({ id: "recipes.cookbooks.titleLabel" })}
              className="h-12 rounded-full px-4 text-base"
              placeholder={intl.formatMessage({ id: "recipes.cookbooks.titlePlaceholder" })}
              returnKeyType="done"
              testID={`${name}-title`}
              value={value}
              onChangeText={onChange}
              onSubmitEditing={disabled ? undefined : onSubmit}
            />
          </TextField>
        )}
      </SheetBody>
    </Sheet>
  );
}
