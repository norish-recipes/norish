import type { NavigationProp, ParamListBase } from "expo-router/react-navigation";
import { useEffect, useEffectEvent } from "react";
import { useNavigation } from "expo-router";

/** The tab navigator, which tells a press of its own tab: the screen's stack sits between. */
type TabsNavigation = NavigationProp<
  ParamListBase,
  string,
  undefined,
  never,
  object,
  { tabPress: { data: undefined; canPreventDefault: true } }
>;

/** Calls `onReselect` when the tab this screen is in is pressed while the screen is in front. */
export function useTabReselect(onReselect: () => void) {
  const navigation = useNavigation();
  const reselect = useEffectEvent(onReselect);

  useEffect(() => {
    // The tab navigator is an ancestor, however many stacks sit between it and the screen.
    const stops: (() => void)[] = [];

    for (let parent = navigation.getParent<TabsNavigation>(); parent; parent = parent.getParent()) {
      stops.push(
        parent.addListener("tabPress", () => {
          if (navigation.isFocused()) reselect();
        })
      );
    }

    return () => stops.forEach((stop) => stop());
  }, [navigation]);
}
