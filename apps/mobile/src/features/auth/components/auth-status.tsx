import React from "react";
import { Text, View } from "react-native";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";

interface AuthStatusProps {
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
  /** `screen` sets the status screens' larger type under their badge; `inline` sits where a form would. */
  size?: "inline" | "screen";
  titleTestID?: string;
  descriptionTestID?: string;
}

const TYPE = {
  inline: {
    block: "items-center gap-2",
    title: "text-foreground text-center text-[17px] font-semibold",
    description: "text-muted text-center text-[15px] font-normal",
  },
  screen: {
    block: "mt-2 items-center gap-4",
    title: "text-foreground text-center text-[26px] leading-8 font-semibold tracking-[-0.57px]",
    description: "text-muted text-center text-[17px] leading-6 font-normal",
  },
};

/** A title, a line and at most one action. */
export function AuthStatus({
  title,
  description,
  action,
  size = "inline",
  titleTestID,
  descriptionTestID,
}: AuthStatusProps) {
  const type = TYPE[size];

  return (
    <View className={type.block}>
      <Text className={type.title} testID={titleTestID}>
        {title}
      </Text>
      <Text className={type.description} testID={descriptionTestID}>
        {description}
      </Text>
      {action ? (
        <View className="mt-4 self-stretch">
          <AuthSubmitButton label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}
