import React from "react";
import { View } from "react-native";
import { Card, CardRow } from "@/components/card";
import { Checkmark } from "@/components/checkmark";
import { SheetBody } from "@/components/sheet";

export type Choice = { id: string | null; label: string; color?: string };

export function ChoiceList({
  choices,
  value,
  prefix,
  onPick,
}: {
  choices: Choice[];
  value: string | null;
  prefix: string;
  onPick: (id: string | null) => void;
}) {
  return (
    <SheetBody>
      <Card>
        {choices.map((choice, index) => (
          <CardRow
            key={choice.id ?? "none"}
            chevron={false}
            first={index === 0}
            label={choice.label}
            selected={choice.id === value}
            leading={
              <View
                className="size-2.5 rounded-full"
                style={choice.color ? { backgroundColor: choice.color } : undefined}
              />
            }
            testID={`${prefix}-${choice.id ?? "none"}`}
            onPress={() => onPick(choice.id)}
          >
            {choice.id === value ? <Checkmark /> : null}
          </CardRow>
        ))}
      </Card>
    </SheetBody>
  );
}
