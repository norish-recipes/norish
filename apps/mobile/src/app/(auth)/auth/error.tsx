import { Button, Card, useThemeColor } from 'heroui-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const DEFAULT_PROTECTED_ROUTE = '/recipes';

function firstRouteParam(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

function sanitizeRedirectTarget(target: string | null | undefined): string {
  if (!target) return DEFAULT_PROTECTED_ROUTE;
  let candidate = target;

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // keep raw
  }

  if (!candidate.startsWith('/') || candidate.startsWith('//')) return DEFAULT_PROTECTED_ROUTE;
  if (candidate === '/login' || candidate.startsWith('/auth/')) return DEFAULT_PROTECTED_ROUTE;

  return candidate;
}

export default function AuthErrorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [foregroundColor, mutedColor, dangerColor] = useThemeColor([
    'foreground',
    'muted',
    'danger',
  ] as const);

  const errorCode = firstRouteParam(params.error as string | string[] | undefined) ?? 'unknown';

  const errorDescription =
    firstRouteParam(params.error_description as string | string[] | undefined) ??
    'The OAuth callback could not be completed.';

  const redirectTo = useMemo(
    () =>
      sanitizeRedirectTarget(
        firstRouteParam(params.redirectTo as string | string[] | undefined) ??
          DEFAULT_PROTECTED_ROUTE,
      ),
    [params.redirectTo],
  );

  return (
    <View style={styles.screen}>
      <Card variant="secondary" className="rounded-3xl border border-separator">
        <Card.Body style={styles.cardBody}>
          <Card.Title style={{ color: dangerColor }}>Sign-in failed</Card.Title>
          <Card.Description style={{ color: mutedColor }}>{errorDescription}</Card.Description>
          <Text style={{ color: mutedColor, fontSize: 12 }}>Error code: {errorCode}</Text>

          <Button
            onPress={() => {
              router.replace(
                {
                  pathname: '/login',
                  params: {
                    redirectTo,
                  },
                } as never,
              );
            }}
          >
            <Button.Label>Try again</Button.Label>
          </Button>

          <Button
            variant="secondary"
            onPress={() => {
              router.replace('/connect' as never);
            }}
          >
            <Button.Label>Back to Connect</Button.Label>
          </Button>
        </Card.Body>
      </Card>

      <Text style={[styles.helpText, { color: foregroundColor }]}>You can retry sign-in or confirm your backend URL in Connect.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
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
