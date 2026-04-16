import React from "react";
import { ActivityIndicator, View } from "react-native";

// The expoClient plugin from @better-auth/expo intercepts the deep link
// (mobile://) and automatically extracts the session cookie. Once the session
// is established, the Stack.Protected guard in the root layout redirects to
// the authenticated tab stack. This screen is just a loading indicator while
// that happens.
export default function AuthCallbackScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
