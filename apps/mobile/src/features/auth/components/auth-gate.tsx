import type { AuthClient } from "@/lib/auth/auth-client";
import type { ReactNode } from "react";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { Brand } from "@/components/brand";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { AuthStatus } from "@/features/auth/components/auth-status";
import { FADE_IN } from "@/features/auth/utils/motion";
import { resolveMethodsStatus } from "@/features/auth/utils/sign-in-methods";
import { useAuthClient } from "@/lib/auth/use-auth-client";
import { useRouter } from "expo-router";
import { Spinner } from "heroui-native";
import { useIntl } from "react-intl";

import { useAuthProvidersQuery } from "@norish/shared-react/config";

export type AuthConfig = ReturnType<typeof useAuthProvidersQuery>;

interface AuthGateProps {
  /** The message id of the line over the brand, such as "Sign in to". */
  titleId: string;
  slogan: boolean;
  footer: ReactNode;
  /** Under the native header, with its back button (Sign up). */
  underHeader?: boolean;
  /** Shows nothing while loading, then fades the whole screen in, footer too (a session end's arrival). */
  fadeIn?: boolean;
  /** Whether the loaded config top-aligns the block; status screens and the spinner stay centred. */
  topAligned?: (config: AuthConfig) => boolean;
  /** What the form shows once there is a server and its config has loaded. */
  children: (authClient: AuthClient, config: AuthConfig) => ReactNode;
}

/** The brand, its title and what sits under it, fading in once where they stay. */
function AuthBlock({
  titleId,
  slogan,
  fades = true,
  children,
}: Pick<AuthGateProps, "titleId" | "slogan"> & { fades?: boolean; children: ReactNode }) {
  const intl = useIntl();

  return (
    <Animated.View entering={fades ? FADE_IN : undefined}>
      <Brand compact prefix={intl.formatMessage({ id: titleId })} slogan={slogan} />
      <View className="mt-7">{children}</View>
    </Animated.View>
  );
}

function ConfigGate({
  authClient,
  titleId,
  slogan,
  footer,
  fadeIn,
  underHeader,
  topAligned,
  children,
}: Pick<
  AuthGateProps,
  "titleId" | "slogan" | "footer" | "fadeIn" | "underHeader" | "topAligned" | "children"
> & {
  authClient: AuthClient;
}) {
  const intl = useIntl();
  const config = useAuthProvidersQuery();
  const status = resolveMethodsStatus(config);

  if (status === "loading" && fadeIn) return null;

  // The spinner stands alone, so the block never moves when the content replaces it.
  if (status === "loading") {
    return (
      <AuthLayout footer={footer} underHeader={underHeader}>
        <Spinner className="self-center" />
      </AuthLayout>
    );
  }

  // A failed background refetch leaves loaded config up, so the form keeps its state.
  if (status === "failed") {
    return (
      <AuthLayout footer={footer} underHeader={underHeader}>
        <AuthBlock slogan={slogan} titleId={titleId}>
          <AuthStatus
            action={{
              label: intl.formatMessage({ id: "common.actions.retry" }),
              onPress: () => void config.refetch(),
            }}
            description={intl.formatMessage({ id: "auth.errors.default.description" })}
            title={intl.formatMessage({ id: "auth.errors.default.title" })}
          />
        </AuthBlock>
      </AuthLayout>
    );
  }

  const form = (
    <AuthLayout footer={footer} topAligned={topAligned?.(config)} underHeader={underHeader}>
      <AuthBlock fades={!fadeIn} slogan={slogan} titleId={titleId}>
        {children(authClient, config)}
      </AuthBlock>
    </AuthLayout>
  );

  return fadeIn ? (
    <Animated.View entering={FADE_IN} style={styles.fill}>
      {form}
    </Animated.View>
  ) : (
    form
  );
}

/** A signed-out form's frame: no server, loading and failed config, or the form itself. */
export function AuthGate({
  titleId,
  slogan,
  footer,
  fadeIn = false,
  underHeader = false,
  topAligned,
  children,
}: AuthGateProps) {
  const router = useRouter();
  const intl = useIntl();
  const authClient = useAuthClient();

  if (authClient === null) {
    return (
      <AuthLayout footer={footer} underHeader={underHeader}>
        <AuthBlock slogan={slogan} titleId={titleId}>
          <AuthStatus
            action={{
              label: intl.formatMessage({ id: "auth.connect.openServerAddress" }),
              onPress: () => router.replace("/(auth)"),
            }}
            description={intl.formatMessage({ id: "auth.connect.noServerAddressDescription" })}
            title={intl.formatMessage({ id: "auth.connect.noServerAddressTitle" })}
          />
        </AuthBlock>
      </AuthLayout>
    );
  }

  return (
    <ConfigGate
      authClient={authClient}
      fadeIn={fadeIn}
      footer={footer}
      slogan={slogan}
      titleId={titleId}
      topAligned={topAligned}
      underHeader={underHeader}
    >
      {children}
    </ConfigGate>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
