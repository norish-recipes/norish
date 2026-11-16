import React from "react";
import { Text } from "react-native";

/** What a grocery line reads aloud: its amount, then its name. */
export const amountNameLabel = (amount: string, name: string) =>
  [amount, name].filter(Boolean).join(" ");

/** A line's amount in the accent, then its name; struck through and muted once `done`. */
export function AmountName({
  amount,
  name,
  done = false,
  className,
  numberOfLines,
}: {
  amount: string;
  name: string;
  done?: boolean;
  /** The size and layout classes of the line. */
  className: string;
  numberOfLines?: number;
}) {
  return (
    <Text
      className={`${className} ${done ? "text-muted line-through" : "text-foreground"}`}
      numberOfLines={numberOfLines}
    >
      {amount ? (
        <Text className={`font-medium ${done ? "text-muted" : "text-accent-text"}`}>
          {`${amount} `}
        </Text>
      ) : null}
      {name}
    </Text>
  );
}
