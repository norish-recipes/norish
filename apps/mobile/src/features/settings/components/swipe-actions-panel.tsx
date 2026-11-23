import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import React from "react";
import { Text, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import Ionicons from "@expo/vector-icons/Ionicons";

import type { SettingsRowAction } from "../utils/row-actions";
import { actionLook } from "../utils/row-actions";
import { useActionTone } from "./use-action-tone";

// A swipe circle is 34 pt under a 11 pt label, in a 52 pt slot.
const SLOT = 52;
const CIRCLE = 34;

/** The circles a swiped row reveals; a press closes the row, then runs the action. */
export function SwipeActionsPanel({
  actions,
  enabled,
  methods,
}: {
  actions: SettingsRowAction[];
  enabled: boolean;
  methods: SwipeableMethods;
}) {
  const toneOf = useActionTone();

  return (
    <View
      className="flex-row items-center justify-end pl-1"
      style={{ width: SLOT * actions.length + 4, opacity: enabled ? 1 : 0.4 }}
    >
      {actions.map((action) => {
        const look = actionLook(action.kind);
        const tone = toneOf(look.tone);

        return (
          <PressableScale
            key={action.kind}
            accessibilityLabel={action.label}
            accessibilityRole="button"
            accessibilityState={{ disabled: !enabled }}
            className="w-[52px] items-center gap-[3px]"
            disabled={!enabled}
            testID={`settings-action-${action.kind}`}
            onPress={() => {
              methods.close();
              action.onPress();
            }}
          >
            <View
              className={`items-center justify-center rounded-full ${tone.ground}`}
              style={{ width: CIRCLE, height: CIRCLE }}
            >
              <Ionicons color={tone.ink} name={look.icon} size={16} />
            </View>
            <Text
              className="text-muted w-full text-center text-[11px] font-medium"
              ellipsizeMode="tail"
              numberOfLines={1}
            >
              {action.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
