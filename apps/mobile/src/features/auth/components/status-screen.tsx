import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { AuthStatus } from "@/features/auth/components/auth-status";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { ServerChip } from "@/features/auth/components/server-chip";
import Feather from "@expo/vector-icons/Feather";

interface StatusScreenProps {
  badge: ReactNode;
  title: string;
  description: string;
  titleTestID?: string;
  descriptionTestID?: string;
  action?: { label: string; onPress: () => void; testID?: string };
  /** The Server Address whose chip sits at the foot, where one is known. */
  chipAddress?: string;
}

/** The status screens' layout: badge, title and line centred, the action and chip pinned below. */
export function StatusScreen({
  badge,
  title,
  description,
  titleTestID,
  descriptionTestID,
  action,
  chipAddress,
}: StatusScreenProps) {
  return (
    <AuthLayout
      status
      footer={
        // 16pt between the block, the action and the chip.
        <View className={action && chipAddress ? "gap-4 pt-4" : undefined}>
          {action ? (
            <AuthSubmitButton
              icon={(color) => <Feather color={color} name="refresh-cw" size={20} />}
              label={action.label}
              testID={action.testID}
              onPress={action.onPress}
            />
          ) : null}
          {chipAddress ? <ServerChip address={chipAddress} /> : null}
        </View>
      }
    >
      <View className="items-center gap-4 px-2">
        {badge}
        <AuthStatus
          description={description}
          descriptionTestID={descriptionTestID}
          size="screen"
          title={title}
          titleTestID={titleTestID}
        />
      </View>
    </AuthLayout>
  );
}
