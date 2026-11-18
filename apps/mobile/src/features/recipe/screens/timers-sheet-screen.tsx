import React from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { Sheet } from "@/components/sheet";
import { cookModeRoute } from "@/lib/tab-routes";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { AllTimers } from "../components/timer-list";
import { timerCookStep } from "../utils/timer-step";

/** The most of the window the rows take before they scroll, as the shared sheets' first detent. */
const MAX_HEIGHT_SHARE = 0.62;

/** How long the sheet takes to leave before UIKit can present cook mode: 400 ms still left it unpresented. */
const SHEET_LEFT_MS = 800;

/** The capsule's sheet: every Recipe Timer on the device, as tall as its rows; a row opens cook mode on its step. */
export function TimersSheetScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { height } = useWindowDimensions();

  return (
    <Sheet name="timers" title={intl.formatMessage({ id: "recipes.cookMode.timers" })}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: height * MAX_HEIGHT_SHARE }}
      >
        <View className="pb-4">
          <AllTimers
            onEmpty={() => router.back()}
            onOpen={(timer) => {
              const cook = cookModeRoute(timer.recipeId, timerCookStep(timer));

              // UIKit cannot present cook mode while the sheet is still leaving.
              router.back();
              setTimeout(() => router.push(cook), SHEET_LEFT_MS);
            }}
          />
        </View>
      </ScrollView>
    </Sheet>
  );
}
