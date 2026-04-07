import type { ReactNode } from "react";
import React from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { Card, useThemeColor } from "heroui-native";

import { AuthLogo } from "../auth/auth-logo";

interface AuthShellProps {
  /** Text before the logo in the heading row, e.g. "Sign in to" */
  headingPrefix: string;
  /** Content rendered inside the card. */
  children: ReactNode;
  /** Optional content rendered below the card (links, error messages, etc.) */
  footer?: ReactNode;
}

/**
 * Shared visual shell for all auth screens (connect, login, register).
 *
 * Renders the heading row (text + inline logo), a subtitle, and a Card
 * wrapper. Each screen provides its own card content and optional footer.
 */
export function AuthShell({ headingPrefix, children, footer }: AuthShellProps) {
  const [foregroundColor] = useThemeColor(["foreground"] as const);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <View style={styles.heroCopy}>
          <View style={styles.headingRow}>
            <Text style={[styles.title, { color: foregroundColor }]}>{headingPrefix} </Text>
            <AuthLogo inline width={110} />
          </View>
        </View>

        <Card variant="secondary" className="border-separator rounded-3xl border">
          <Card.Body style={styles.cardBody}>{children}</Card.Body>
        </Card>

        {footer}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
    gap: 20,
  },
  heroCopy: {
    gap: 12,
    paddingHorizontal: 4,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  cardBody: {
    gap: 12,
    padding: 16,
  },
});
