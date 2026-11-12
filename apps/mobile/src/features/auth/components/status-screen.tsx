import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { AuthStatus } from "@/features/auth/components/auth-status";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { ServerChip } from "@/features/auth/components/server-chip";

interface StatusScreenProps {
  badge: ReactNode;
  title: string;
  description: string;
  descriptionTestID?: string;
  action?: { label: string; onPress: () => void };
  /** The Server Address whose chip sits at the foot, where one is known. */
  chipAddress?: string;
}

/** The status screens' layout: badge, title and line centred, the action and chip pinned below. */
export function StatusScreen({
  badge,
  title,
  description,
  descriptionTestID,
  action,
  chipAddress,
}: StatusScreenProps) {
  return (
    <AuthLayout
      footer={
        <>
          {action ? <AuthSubmitButton label={action.label} onPress={action.onPress} /> : null}
          {chipAddress ? <ServerChip address={chipAddress} /> : null}
        </>
      }
    >
      <View className="items-center gap-4 px-2">
        {badge}
        <AuthStatus
          description={description}
          descriptionTestID={descriptionTestID}
          size="screen"
          title={title}
        />
      </View>
    </AuthLayout>
  );
}
