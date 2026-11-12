import type { AuthClient } from "@/lib/auth/auth-client";
import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
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
  topAligned?: boolean;
  /** What the form shows once there is a server and its config has loaded. */
  children: (authClient: AuthClient, config: AuthConfig) => ReactNode;
}

/** The brand, its title and what sits under it, fading in once where they stay. */
function AuthBlock({
  titleId,
  slogan,
  children,
}: Pick<AuthGateProps, "titleId" | "slogan"> & { children: ReactNode }) {
  const intl = useIntl();

  return (
    <Animated.View entering={FADE_IN}>
      <Brand compact prefix={intl.formatMessage({ id: titleId })} slogan={slogan} />
      <View className="mt-7">{children}</View>
    </Animated.View>
  );
}

function ConfigGate({
  authClient,
  titleId,
  slogan,
  children,
}: Pick<AuthGateProps, "titleId" | "slogan" | "children"> & { authClient: AuthClient }) {
  const intl = useIntl();
  const config = useAuthProvidersQuery();
  const status = resolveMethodsStatus(config);

  // The spinner stands alone, so the block never moves when the content replaces it.
  if (status === "loading") {
    return <Spinner className="self-center" />;
  }

  // A failed background refetch leaves loaded config up, so the form keeps its state.
  if (status === "failed") {
    return (
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
    );
  }

  return (
    <AuthBlock slogan={slogan} titleId={titleId}>
      {children(authClient, config)}
    </AuthBlock>
  );
}

/** A signed-out form's frame: no server, loading and failed config, or the form itself. */
export function AuthGate({ titleId, slogan, footer, topAligned, children }: AuthGateProps) {
  const router = useRouter();
  const intl = useIntl();
  const authClient = useAuthClient();

  return (
    <AuthLayout footer={footer} topAligned={topAligned}>
      {authClient === null ? (
        <AuthBlock slogan={slogan} titleId={titleId}>
          <AuthStatus
            action={{
              label: intl.formatMessage({ id: "auth.connect.openConnect" }),
              onPress: () => router.replace("/(auth)"),
            }}
            description={intl.formatMessage({ id: "auth.connect.backendRequiredDescription" })}
            title={intl.formatMessage({ id: "auth.connect.backendRequiredTitle" })}
          />
        </AuthBlock>
      ) : (
        <ConfigGate authClient={authClient} slogan={slogan} titleId={titleId}>
          {children}
        </ConfigGate>
      )}
    </AuthLayout>
  );
}
