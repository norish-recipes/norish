import type { InlineErrorState } from "@/features/auth/components/inline-error";
import type { AuthClient } from "@/lib/auth/auth-client";
import React, { use, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Brand } from "@/components/brand";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { InlineError, useErrorShake } from "@/features/auth/components/inline-error";
import { ProviderIcon } from "@/features/auth/components/provider-icon";
import { ServerChip } from "@/features/auth/components/server-chip";
import { authFailure } from "@/features/auth/utils/auth-failure";
import {
  DEFAULT_PROTECTED_ROUTE,
  firstParam,
  sanitizeRedirectTarget,
} from "@/features/auth/utils/redirect";
import { resolveSignInMethods } from "@/features/auth/utils/sign-in-methods";
import { useAuthClient } from "@/lib/auth/use-auth-client";
import { ServerAddressContext } from "@/lib/network/server-address";
import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Button,
  InputGroup,
  Label,
  Separator,
  Spinner,
  TextField,
  useThemeColor,
} from "heroui-native";
import { useIntl } from "react-intl";

import type { ProviderInfo } from "@norish/shared/contracts";
import { useAuthProvidersQuery } from "@norish/shared-react/config";

/** A title, a line and at most one action, where the form would be. */
function LoginStatus({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="items-center gap-2">
      <Text className="text-foreground text-center text-[17px] font-semibold">{title}</Text>
      <Text className="text-muted text-center text-[15px] font-normal">{description}</Text>
      {action ? (
        <Button className="mt-4 self-stretch rounded-full" size="lg" onPress={action.onPress}>
          <Button.Label>{action.label}</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}

function PasswordForm({ authClient, signUp }: { authClient: AuthClient; signUp: boolean }) {
  const router = useRouter();
  const intl = useIntl();
  const [mutedColor, accentForegroundColor] = useThemeColor([
    "muted",
    "accent-foreground",
  ] as const);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordShown, setIsPasswordShown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<InlineErrorState>(null);
  const shakeStyle = useErrorShake(error);
  const canSubmit = email.trim() !== "" && password !== "" && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    // On success the Stack.Protected guard leaves Sign in once the session lands.
    const failure = await authFailure(
      authClient.signIn.email({ email: email.trim(), password }),
      "auth.errors.default.description"
    );

    if (failure !== null) setError({ message: intl.formatMessage({ id: failure }) });

    setIsSubmitting(false);
  };

  return (
    <View className="gap-3.5">
      <Animated.View className="gap-3.5" style={shakeStyle}>
        <TextField isInvalid={error !== null}>
          <Label className="pl-1" isInvalid={false}>
            {intl.formatMessage({ id: "auth.emailPassword.email" })}
          </Label>
          <InputGroup>
            <InputGroup.Input
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder={intl.formatMessage({ id: "auth.emailPassword.emailPlaceholder" })}
              returnKeyType="next"
              testID="login-email"
              textContentType="username"
              value={email}
              onChangeText={setEmail}
            />
          </InputGroup>
        </TextField>
        <TextField isInvalid={error !== null}>
          <Label className="pl-1" isInvalid={false}>
            {intl.formatMessage({ id: "auth.emailPassword.password" })}
          </Label>
          <InputGroup>
            <InputGroup.Input
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={intl.formatMessage({ id: "auth.emailPassword.passwordPlaceholder" })}
              returnKeyType="go"
              secureTextEntry={!isPasswordShown}
              testID="login-password"
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => void handleSubmit()}
            />
            <InputGroup.Suffix>
              <Pressable
                accessibilityLabel={intl.formatMessage({
                  id: isPasswordShown
                    ? "auth.emailPassword.hidePassword"
                    : "auth.emailPassword.showPassword",
                })}
                accessibilityRole="button"
                className="size-10 items-center justify-center"
                hitSlop={4}
                onPress={() => setIsPasswordShown((shown) => !shown)}
              >
                <Feather color={mutedColor} name={isPasswordShown ? "eye-off" : "eye"} size={20} />
              </Pressable>
            </InputGroup.Suffix>
          </InputGroup>
        </TextField>
      </Animated.View>
      <InlineError error={error} />

      {signUp ? (
        <Pressable accessibilityRole="link" onPress={() => router.push("/register")}>
          <Text className="text-muted mt-0.5 text-center text-[15px] font-normal">
            {intl.formatMessage({ id: "auth.emailPassword.noAccount" })}{" "}
            <Text className="text-accent font-semibold">
              {intl.formatMessage({ id: "auth.emailPassword.signUp" })}
            </Text>
          </Text>
        </Pressable>
      ) : null}

      <Button
        className="rounded-full"
        isDisabled={!canSubmit}
        size="lg"
        testID="login-submit"
        onPress={() => void handleSubmit()}
      >
        {isSubmitting ? (
          <Spinner color={accentForegroundColor} size="sm" />
        ) : (
          <Feather color={accentForegroundColor} name="log-in" size={20} />
        )}
        <Button.Label>{intl.formatMessage({ id: "auth.emailPassword.signIn" })}</Button.Label>
      </Button>
    </View>
  );
}

function ProviderButtons({
  authClient,
  providers,
  redirectTo,
}: {
  authClient: AuthClient;
  providers: ProviderInfo[];
  redirectTo: string;
}) {
  const intl = useIntl();
  const [foregroundColor] = useThemeColor(["foreground"] as const);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [error, setError] = useState<InlineErrorState>(null);
  const shakeStyle = useErrorShake(error);

  const handlePress = async (provider: ProviderInfo) => {
    setError(null);
    setActiveProviderId(provider.id);

    const failure = await authFailure(
      authClient.signIn.social({ provider: provider.id, callbackURL: redirectTo }),
      "auth.errors.default.description"
    );

    if (failure !== null) setError({ message: intl.formatMessage({ id: failure }) });

    setActiveProviderId(null);
  };

  return (
    <View className="gap-2.5">
      <Animated.View className="gap-2.5" style={shakeStyle}>
        {providers.map((provider) => (
          <Button
            key={provider.id}
            className="bg-surface rounded-full"
            isDisabled={activeProviderId !== null}
            size="lg"
            variant="outline"
            onPress={() => void handlePress(provider)}
          >
            {activeProviderId === provider.id ? (
              <Spinner color={foregroundColor} size="sm" />
            ) : (
              <ProviderIcon color={foregroundColor} icon={provider.icon} size={18} />
            )}
            <Button.Label className="text-foreground text-base font-medium">
              {intl.formatMessage({ id: "auth.provider.signInWith" }, { provider: provider.name })}
            </Button.Label>
          </Button>
        ))}
      </Animated.View>
      <InlineError error={error} />
    </View>
  );
}

function OrDivider() {
  const intl = useIntl();

  return (
    <View className="mt-5 mb-4 flex-row items-center gap-3">
      <Separator className="flex-1" />
      <Text className="text-muted text-sm font-normal">
        {intl.formatMessage({ id: "auth.login.divider" })}
      </Text>
      <Separator className="flex-1" />
    </View>
  );
}

function SignInMethods({ authClient, redirectTo }: { authClient: AuthClient; redirectTo: string }) {
  const intl = useIntl();
  const config = useAuthProvidersQuery();
  const methods = resolveSignInMethods(config);

  if (config.isLoading) {
    return <Spinner className="self-center" />;
  }

  if (config.error) {
    return (
      <LoginStatus
        action={{
          label: intl.formatMessage({ id: "common.actions.retry" }),
          onPress: () => void config.refetch(),
        }}
        description={intl.formatMessage({ id: "auth.errors.default.description" })}
        title={intl.formatMessage({ id: "auth.errors.default.title" })}
      />
    );
  }

  if (methods.noMethod) {
    return (
      <LoginStatus
        description={intl.formatMessage({ id: "auth.login.noProviders.contactAdmin" })}
        title={intl.formatMessage({ id: "auth.login.noProviders.title" })}
      />
    );
  }

  return (
    <View>
      {methods.passwordForm ? (
        <PasswordForm authClient={authClient} signUp={methods.signUp} />
      ) : null}
      {methods.divider ? <OrDivider /> : null}
      {methods.providerButtons ? (
        <ProviderButtons
          authClient={authClient}
          providers={methods.oauthProviders}
          redirectTo={redirectTo}
        />
      ) : null}
    </View>
  );
}

export function LoginScreen() {
  const router = useRouter();
  const intl = useIntl();
  const params = useLocalSearchParams<{ redirectTo?: string | string[] }>();
  const authClient = useAuthClient();
  const serverAddress = use(ServerAddressContext);
  const redirectTo = sanitizeRedirectTarget(
    firstParam(params.redirectTo) ?? DEFAULT_PROTECTED_ROUTE
  );

  return (
    <AuthLayout footer={serverAddress ? <ServerChip address={serverAddress} /> : null}>
      <Brand compact prefix={intl.formatMessage({ id: "auth.login.title" })} />
      <View className="mt-7">
        {authClient === null ? (
          <LoginStatus
            action={{
              label: intl.formatMessage({ id: "auth.connect.openConnect" }),
              onPress: () => router.replace("/(auth)"),
            }}
            description={intl.formatMessage({ id: "auth.connect.backendRequiredDescription" })}
            title={intl.formatMessage({ id: "auth.connect.backendRequiredTitle" })}
          />
        ) : (
          <SignInMethods authClient={authClient} redirectTo={redirectTo} />
        )}
      </View>
    </AuthLayout>
  );
}
