import type { ComponentProps } from "react";
import React from "react";
import { Pressable, Text } from "react-native";
import { EmptyCard } from "@/components/empty-card";
import { useWarningInkColor } from "@/hooks/use-warning-ink-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useIntl } from "react-intl";

type Icon = ComponentProps<typeof Ionicons>["name"];

/** Nothing to show: the card in the warning tone unless `tone` says otherwise, and the one action that would change that. */
export function NoResultsCard({
  icon,
  title,
  description,
  tone = "warning",
  ink,
  className,
  testID,
  action,
}: {
  icon: Icon;
  /** Defaults to "No results". */
  title?: string;
  description?: string;
  tone?: "warning" | "neutral";
  /** The icon's colour token, over the tone's own. */
  ink?: string;
  className?: string;
  testID: string;
  action?: { label: string; icon: Icon; testID: string; onPress: () => void };
}) {
  const intl = useIntl();
  const warningInk = useWarningInkColor();

  return (
    <EmptyCard
      className={className}
      description={description}
      icon={icon}
      ink={ink}
      testID={testID}
      title={title ?? intl.formatMessage({ id: "recipes.empty.noResults" })}
      tone={tone}
    >
      {action ? (
        <Pressable
          accessibilityRole="button"
          className="bg-warning/20 h-11 flex-row items-center justify-center gap-2 rounded-full"
          testID={action.testID}
          onPress={action.onPress}
        >
          <Ionicons color={warningInk} name={action.icon} size={18} />
          <Text className="text-warning-ink text-[15px] font-medium">{action.label}</Text>
        </Pressable>
      ) : null}
    </EmptyCard>
  );
}
