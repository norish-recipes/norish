import type { ReactNode } from "react";
import React from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AuthLayoutProps {
  /** The block centred vertically in the space above the footer. */
  children: ReactNode;
  /** Pinned to the bottom, above the home indicator. */
  footer?: ReactNode;
  /** Sets the block 40pt under the top instead of centring it, as sign-in does. */
  topAligned?: boolean;
  /** Centres the block in the whole space above the footer, with no bounce, for status screens. */
  status?: boolean;
  /** Starts the space under the native header's 48pt row, as the Register board does. */
  underHeader?: boolean;
}

const HEADER_ROW = 48;

/** The signed-out screens' frame: a centred block over an optional pinned footer. */
export function AuthLayout({
  children,
  footer,
  topAligned = false,
  status = false,
  underHeader = false,
}: AuthLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <ScrollView
        alwaysBounceVertical={!status}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + (underHeader ? HEADER_ROW : 0),
          paddingBottom: insets.bottom,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className={
            topAligned
              ? "flex-1 pt-10"
              : status
                ? "flex-1 justify-center"
                : "flex-1 justify-center pb-10"
          }
        >
          {children}
        </View>
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
