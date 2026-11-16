import React, { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { cookModeRoute } from "@/lib/tab-routes";
import { Button, Host } from "@expo/ui/swift-ui";
import {
  accessibilityIdentifier,
  buttonStyle,
  controlSize,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { BAR_BOTTOM, BAR_HEIGHT } from "./cook-bar";
import { TimerScrim } from "./timer-list";
import { TimerPill } from "./timer-pill";

const SIDE = 20;

/** The page's floating foot, part of the page so it slides with it and sits under its sheets:
 * the timer pill on the left while a timer exists, Cook on the right. */
export function RecipeControls({ recipeId }: { recipeId: string }) {
  const intl = useIntl();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [accent] = useThemeColor(["accent"] as const);
  const [timersOpen, setTimersOpen] = useState(false);

  return (
    <>
      {timersOpen ? <TimerScrim onClose={() => setTimersOpen(false)} /> : null}
      <View className="absolute" style={{ bottom: BAR_BOTTOM, right: SIDE }}>
        <Host matchContents>
          <Button
            label={intl.formatMessage({ id: "recipes.detail.cook" })}
            modifiers={[
              buttonStyle("glassProminent"),
              controlSize("large"),
              tint(accent),
              accessibilityIdentifier("recipe-cook"),
            ]}
            onPress={() => router.push(cookModeRoute(recipeId))}
          />
        </Host>
      </View>
      <TimerPill
        bottom={BAR_BOTTOM}
        height={BAR_HEIGHT}
        left={SIDE}
        listWidth={width - SIDE * 2}
        open={timersOpen}
        testID="recipe-timer-pill"
        onOpenChange={setTimersOpen}
      />
    </>
  );
}
