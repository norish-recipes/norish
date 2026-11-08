import React from "react";
import { Card, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

export function NoProvidersState() {
  const intl = useIntl();
  const [foregroundColor, mutedColor] = useThemeColor(["foreground", "muted"] as const);

  return (
    <>
      <Card.Title style={{ color: foregroundColor }}>
        {intl.formatMessage({ id: "auth.login.noProviders.title" })}
      </Card.Title>
      <Card.Description style={{ color: mutedColor }}>
        {intl.formatMessage({ id: "auth.login.noProviders.contactAdmin" })}
      </Card.Description>
    </>
  );
}
