import React from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { Card } from "@/components/card";
import { Sheet } from "@/components/sheet";
import { openAfterSheet, useSheetPresenting } from "@/lib/after-sheet";
import { cookModeRoute } from "@/lib/tab-routes";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { AllTimers } from "../components/timer-list";

/** The most of the window the rows take before they scroll, as the shared sheets' first detent. */
const MAX_HEIGHT_SHARE = 0.62;

/** The capsule's sheet: every Recipe Timer on the device, as tall as its rows; a row opens cook mode on its step. */
export function TimersSheetScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { height } = useWindowDimensions();

  const sheet = useSheetPresenting();

  return (
    <Sheet name="timers" title={intl.formatMessage({ id: "recipes.cookMode.timers" })}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: height * MAX_HEIGHT_SHARE }}
      >
        <View className="px-4 pb-4">
          <Card>
            <AllTimers
              onEmpty={() => router.back()}
              onOpen={(timer) => {
                const cook = cookModeRoute(timer.recipeId, timer.stepIndex);

                // UIKit cannot present cook mode while the sheet is still leaving.
                openAfterSheet(
                  sheet,
                  () => router.back(),
                  () => router.push(cook)
                );
              }}
            />
          </Card>
        </View>
      </ScrollView>
    </Sheet>
  );
}
