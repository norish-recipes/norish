import React from "react";
import { Card, CardRow } from "@/components/card";
import { Checkmark } from "@/components/checkmark";

export type ChoiceCardOption = { id: string; label: string; hint?: string; testID: string };

/** A card of options to pick one from: the `selected` one carries the kit's check, a `hint` goes
 * under a label. */
export function ChoiceCard({
  options,
  selected,
  onPick,
}: {
  options: readonly ChoiceCardOption[];
  selected?: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <Card>
      {options.map((option, index) => (
        <CardRow
          key={option.id}
          chevron={false}
          first={index === 0}
          hint={option.hint}
          label={option.label}
          selected={selected === undefined ? undefined : selected === option.id}
          testID={option.testID}
          onPress={() => onPick(option.id)}
        >
          {selected === option.id ? <Checkmark /> : null}
        </CardRow>
      ))}
    </Card>
  );
}
