import React from "react";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/card";
import { Checkmark } from "@/components/checkmark";
import { SheetBody } from "@/components/sheet";
import { SliceHairline } from "@/components/slice-row";

export type Choice = { id: string | null; label: string; color?: string };

/** One choice of a list: its dot (a gap where it has none, so labels line up), its label and a
 * check where it is the one held. */
function ChoiceRow({
  choice,
  selected,
  first,
  testID,
  onPick,
}: {
  choice: Choice;
  selected: boolean;
  first: boolean;
  testID: string;
  onPick: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="min-h-[52px] flex-row items-center gap-3 px-4"
      testID={testID}
      onPress={onPick}
    >
      <SliceHairline first={first} />
      <View
        className="size-2.5 rounded-full"
        style={choice.color ? { backgroundColor: choice.color } : undefined}
      />
      <Text className="text-foreground flex-1 text-base">{choice.label}</Text>
      {selected ? <Checkmark /> : null}
    </Pressable>
  );
}

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
          <ChoiceRow
            key={choice.id ?? "none"}
            choice={choice}
            first={index === 0}
            selected={choice.id === value}
            testID={`${prefix}-${choice.id ?? "none"}`}
            onPick={() => onPick(choice.id)}
          />
        ))}
      </Card>
    </SheetBody>
  );
}
