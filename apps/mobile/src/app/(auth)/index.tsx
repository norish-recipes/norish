import React, { useState } from "react";
import { StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { ConnectScreen } from "@/features/auth/screens/connect-screen";
import { LoginScreen } from "@/features/auth/screens/login-screen";
import { FADE_IN } from "@/features/auth/utils/motion";
import { takeServerChangeAfterSignOut } from "@/hooks/use-change-server-address";
import { takeSessionLeft } from "@/lib/auth/auth-session-sync";
import { fadesInAfterSessionEnd, resolveSignedOutEntry } from "@/lib/boot/boot-state";
import { getServerAddress } from "@/lib/network/server-address";
import { useLocalSearchParams } from "expo-router";

/** Server address, or Sign in when a Server Address is saved; picked once, from the boot gate's read. */
export default function SignedOutEntryRoute() {
  const { change } = useLocalSearchParams<{ change?: string }>();
  // A server change that signed out first opens here, so the fresh stack never shows Sign in;
  // the session's end is taken here too, so only the arrival a session end lands on fades.
  const [arrival] = useState(() => {
    const address = getServerAddress();
    const changeRequested = change !== undefined || takeServerChangeAfterSignOut();

    return {
      entry: resolveSignedOutEntry(address, changeRequested),
      fades: fadesInAfterSessionEnd(takeSessionLeft(), address),
    };
  });

  if (arrival.entry === "sign-in") return <LoginScreen fadeIn={arrival.fades} />;

  return arrival.fades ? (
    <Animated.View entering={FADE_IN} style={styles.fill}>
      <ConnectScreen />
    </Animated.View>
  ) : (
    <ConnectScreen />
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
