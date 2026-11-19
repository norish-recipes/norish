import React from "react";
import { View } from "react-native";
import { Card } from "@/components/card";
import { Checkmark } from "@/components/checkmark";
import { SheetBody } from "@/components/sheet";
import { Button } from "heroui-native";

export type Choice = { id: string | null; label: string; color?: string };

/** One choice of a list: its mark, its label and a check where it is the one held. */
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
    <View className={first ? "" : "border-separator border-t"}>
      <Button
        className="h-[52px] justify-start gap-3 rounded-none px-4"
        testID={testID}
        variant="ghost"
        onPress={onPick}
      >
        {choice.color ? (
          <View className="size-2.5 rounded-full" style={{ backgroundColor: choice.color }} />
        ) : null}
        <Button.Label className="text-foreground flex-1 text-base font-normal">
          {choice.label}
        </Button.Label>
        {selected ? <Checkmark /> : null}
      </Button>
    </View>
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
