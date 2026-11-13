import React from "react";
import { Sheet, SheetBody } from "@/components/sheet";
import { Button, Input, Label, TextField } from "heroui-native";
import { useIntl } from "react-intl";

/** Rename a cookbook: one field, with Cancel and Save pinned below. Ticket 14 wires it up. */
export default function CookbookRenameSheet() {
  const intl = useIntl();

  return (
    <Sheet
      actions={
        <Sheet.Actions>
          <Sheet.Action>
            <Button className="h-[50px]" testID="cookbook-rename-cancel" variant="secondary">
              <Button.Label>{intl.formatMessage({ id: "common.actions.cancel" })}</Button.Label>
            </Button>
          </Sheet.Action>
          <Sheet.Action>
            <Button className="h-[50px]" testID="cookbook-rename-save" variant="primary">
              <Button.Label>{intl.formatMessage({ id: "common.actions.save" })}</Button.Label>
            </Button>
          </Sheet.Action>
        </Sheet.Actions>
      }
      name="cookbook-rename"
      title={intl.formatMessage({ id: "recipes.cookbooks.rename" })}
    >
      <SheetBody>
        <TextField>
          <Label>
            <Label.Text>{intl.formatMessage({ id: "recipes.cookbooks.titleLabel" })}</Label.Text>
          </Label>
          <Input
            placeholder={intl.formatMessage({ id: "recipes.cookbooks.titlePlaceholder" })}
            testID="cookbook-rename-title"
          />
        </TextField>
      </SheetBody>
    </Sheet>
  );
}
