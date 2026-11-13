import React from "react";
import { Sheet } from "@/components/sheet";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { usePermissions } from "@norish/shared-react/reader";

/** An import sheet's actions: Import, and AI import beside it when AI is on. */
export function ImportActions({
  name,
  isDisabled,
  isAIDisabled = isDisabled,
  onImport,
  onAIImport,
}: {
  /** The testID prefix: `<name>-submit` and `<name>-ai`. */
  name: string;
  isDisabled: boolean;
  isAIDisabled?: boolean;
  onImport: () => void;
  onAIImport: () => void;
}) {
  const intl = useIntl();
  const isAIEnabled = usePermissions((permissions) => permissions.isAIEnabled);
  const accentText = useAccentTextColor();
  const [accentForeground] = useThemeColor(["accent-foreground"] as const);

  return (
    <Sheet.Actions>
      {isAIEnabled ? (
        <Sheet.Action>
          <Button
            accessibilityLabel={intl.formatMessage({ id: "common.actions.aiImport" })}
            className="h-[50px]"
            isDisabled={isAIDisabled}
            testID={`${name}-ai`}
            variant="tertiary"
            onPress={onAIImport}
          >
            <Ionicons color={accentText} name="sparkles-outline" size={18} />
            <Button.Label className="font-medium">
              {intl.formatMessage({ id: "common.actions.aiImport" })}
            </Button.Label>
          </Button>
        </Sheet.Action>
      ) : null}
      <Sheet.Action>
        <Button
          accessibilityLabel={intl.formatMessage({ id: "common.actions.import" })}
          className="h-[50px]"
          isDisabled={isDisabled}
          testID={`${name}-submit`}
          variant="primary"
          onPress={onImport}
        >
          <Ionicons color={accentForeground} name="download-outline" size={18} />
          <Button.Label className="font-semibold">
            {intl.formatMessage({ id: "common.actions.import" })}
          </Button.Label>
        </Button>
      </Sheet.Action>
    </Sheet.Actions>
  );
}
