import type { ComponentProps } from "react";
import React from "react";
import { Pressable, Text } from "react-native";
import { EmptyCard } from "@/components/empty-card";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useIntl } from "react-intl";

type Icon = ComponentProps<typeof Ionicons>["name"];

/** Nothing to show: the empty card and the one action that would change that. */
export function NoResultsCard({
  icon,
  title,
  className,
  testID,
  action,
}: {
  icon: Icon;
  /** Defaults to "No results". */
  title?: string;
  className?: string;
  testID: string;
  action?: { label: string; icon: Icon; testID: string; onPress: () => void };
}) {
  const intl = useIntl();
  const foreground = useTokenColor("foreground");

  return (
    <EmptyCard
      className={className}
      icon={icon}
      testID={testID}
      title={title ?? intl.formatMessage({ id: "recipes.empty.noResults" })}
    >
      {action ? (
        <Pressable
          accessibilityRole="button"
          className="bg-muted/10 h-11 flex-row items-center justify-center gap-2 rounded-full"
          testID={action.testID}
          onPress={action.onPress}
        >
          <Ionicons color={foreground} name={action.icon} size={18} />
          <Text className="text-foreground text-[15px] font-medium">{action.label}</Text>
        </Pressable>
      ) : null}
    </EmptyCard>
  );
}
