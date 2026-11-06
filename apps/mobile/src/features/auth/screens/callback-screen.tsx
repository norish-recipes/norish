import React from "react";
import { ActivityIndicator, View } from "react-native";

// @better-auth/expo's expoClient takes the session cookie from the norish:// deep link;
// the root layout's Stack.Protected guard then leaves this spinner.
export function AuthCallbackScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
