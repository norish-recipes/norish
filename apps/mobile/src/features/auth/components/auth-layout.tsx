import type { ReactNode } from "react";
import React from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AuthLayoutProps {
  /** The block centred vertically in the space above the footer. */
  children: ReactNode;
  /** Pinned to the bottom, above the home indicator. */
  footer?: ReactNode;
}

/** The signed-out screens' frame: a centred block over an optional pinned footer. */
export function AuthLayout({ children, footer }: AuthLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center pb-10">{children}</View>
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
