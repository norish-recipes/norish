import { Button, Card, useThemeColor } from 'heroui-native';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/auth-context';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [foregroundColor, mutedColor, dangerColor] = useThemeColor([
    'foreground',
    'muted',
    'danger',
  ] as const);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignOut = async () => {
    setErrorMessage(null);
    setIsSigningOut(true);

    try {
      await signOut();
      router.replace('/login?logout=true' as never);
    } catch (error) {
      if (error instanceof Error && error.message) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not sign out. Please try again.');
      }
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="always"
      showsVerticalScrollIndicator={false}
    >
      <Card variant="secondary" className="rounded-2xl border border-separator">
        <Card.Body style={styles.cardBody}>
          <Card.Title style={{ color: foregroundColor }}>Profile</Card.Title>
          <Card.Description style={{ color: mutedColor }}>
            Manage account preferences and end your current mobile session.
          </Card.Description>

          <View style={styles.userDetails}>
            <Text style={[styles.userLabel, { color: mutedColor }]}>Signed in as</Text>
            <Text style={[styles.userValue, { color: foregroundColor }]}>
              {user?.email ?? 'Unknown user'}
            </Text>
          </View>

          <Button
            variant="secondary"
            isDisabled={isSigningOut}
            onPress={() => {
              void handleSignOut();
            }}
          >
            <Button.Label>{isSigningOut ? 'Signing out...' : 'Sign out'}</Button.Label>
          </Button>

          {errorMessage && <Text style={{ color: dangerColor }}>{errorMessage}</Text>}
        </Card.Body>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 16,
  },
  cardBody: {
    gap: 12,
    padding: 16,
  },
  userDetails: {
    gap: 2,
  },
  userLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  userValue: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
});
