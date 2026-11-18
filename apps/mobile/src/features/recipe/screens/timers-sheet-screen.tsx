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
              router.back();
              router.push(cookModeRoute(timer.recipeId, timerCookStep(timer)));
            }}
          />
        </View>
      </ScrollView>
    </Sheet>
  );
}
