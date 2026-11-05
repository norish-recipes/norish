import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  DEFAULT_PROTECTED_ROUTE,
  firstParam,
  sanitizeRedirectTarget,
} from "@/features/auth/utils/redirect";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Card, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

export function AuthErrorScreen() {
  const router = useRouter();
  const intl = useIntl();
  const params = useLocalSearchParams();
  const [foregroundColor, mutedColor, dangerColor] = useThemeColor([
    "foreground",
    "muted",
    "danger",
  ] as const);

  const errorCode = firstParam(params.error as string | string[] | undefined) ?? "unknown";

  const errorDescription =
    firstParam(params.error_description as string | string[] | undefined) ??
    intl.formatMessage({ id: "auth.errors.default.description" });

  const redirectTo = useMemo(
    () =>
      sanitizeRedirectTarget(
        firstParam(params.redirectTo as string | string[] | undefined) ?? DEFAULT_PROTECTED_ROUTE
      ),
    [params.redirectTo]
  );

  return (
    <View style={styles.screen}>
      <Card variant="secondary" className="border-separator rounded-3xl border">
        <Card.Body style={styles.cardBody}>
          <Card.Title style={{ color: dangerColor }}>
            {intl.formatMessage({ id: "auth.errors.default.title" })}
          </Card.Title>
          <Card.Description style={{ color: mutedColor }}>{errorDescription}</Card.Description>
          <Text style={{ color: mutedColor, fontSize: 12 }}>
            {intl.formatMessage({ id: "auth.errors.errorCode" }, { code: errorCode })}
          </Text>

          <Button
            onPress={() => {
              router.replace({
                pathname: "/login",
                params: {
                  redirectTo,
                },
              } as never);
            }}
          >
            <Button.Label>{intl.formatMessage({ id: "common.actions.retry" })}</Button.Label>
          </Button>

          <Button
            variant="secondary"
            onPress={() => {
              router.replace("/(auth)" as never);
            }}
          >
            <Button.Label>{intl.formatMessage({ id: "auth.errors.backToLogin" })}</Button.Label>
          </Button>
        </Card.Body>
      </Card>

      <Text style={[styles.helpText, { color: foregroundColor }]}>
        {intl.formatMessage({ id: "auth.errors.default.description" })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 14,
  },
  cardBody: {
    gap: 12,
    padding: 16,
  },
  helpText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
