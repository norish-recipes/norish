import React from "react";
import { Button, Card, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

export function BackendMissingState({ onOpenConnect }: { onOpenConnect: () => void }) {
  const intl = useIntl();
  const [dangerColor, mutedColor] = useThemeColor(["danger", "muted"] as const);

  return (
    <>
      <Card.Title style={{ color: dangerColor }}>
        {intl.formatMessage({ id: "auth.connect.backendRequiredTitle" })}
      </Card.Title>
      <Card.Description style={{ color: mutedColor }}>
        {intl.formatMessage({ id: "auth.connect.backendRequiredDescription" })}
      </Card.Description>
      <Button
        onPress={() => {
          onOpenConnect();
        }}
      >
        <Button.Label>{intl.formatMessage({ id: "auth.connect.openConnect" })}</Button.Label>
      </Button>
    </>
  );
}
