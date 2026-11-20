import React, { useLayoutEffect } from "react";
import { View } from "react-native";
import Animated, {
  LayoutAnimationConfig,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from "react-native-reanimated";
import { showGroceriesSection, useGroceriesSection } from "@/lib/groceries-section";
import { sprung } from "@/lib/motion/spring";
import { useTabScroll } from "@/lib/use-tab-scroll";

import { GroceryListSection } from "../components/grocery-list-section";
import { ListSwitch } from "../components/list-switch";
import { PantrySection } from "../components/pantry-section";
import { useGroceryListState } from "../hooks/use-grocery-list-state";
import { usePantryScreen } from "../hooks/use-pantry-screen";

// The list sits left of the Pantry: each slides in from, and out to, its own side.
const LIST_IN = sprung(SlideInLeft.springify());
const LIST_OUT = sprung(SlideOutLeft.springify());
const PANTRY_IN = sprung(SlideInRight.springify());
const PANTRY_OUT = sprung(SlideOutRight.springify());

/** The Groceries tab: the list or the Pantry, the switch sliding one out and the other in. Only the
 * shown one is mounted, so it opens at its top and the tab bar follows its scroll; the page keeps
 * both sections' state and the list's realtime, so a switch back finds them as they were. */
export function GroceriesScreen() {
  const section = useGroceriesSection();
  const scroll = useTabScroll();
  const listState = useGroceryListState();
  const pantry = usePantryScreen();

  // The new list opens at its top, so the switch riding the scroll starts there too: a tap resets it
  // before the switch, a link before the frame that shows the new section.
  useLayoutEffect(() => {
    scroll.offset.set(0);
  }, [section, scroll.offset]);

  return (
    <View className="bg-background flex-1">
      {/* First in the tree; its z-index draws it over the lists. */}
      <ListSwitch
        offset={scroll.offset}
        section={section}
        top={scroll.barBottom}
        onChange={(next) => {
          scroll.offset.set(0);
          showGroceriesSection(next);
        }}
      />
      {/* The page's first frame shows its list in place; only a switch slides. */}
      <LayoutAnimationConfig skipEntering>
        {section === "list" ? (
          <Animated.View
            key="list"
            className="absolute inset-0"
            entering={LIST_IN}
            exiting={LIST_OUT}
          >
            {/* A leaving section slides out whole: unmounting, the config flags this unflattened
                view's subtree to skip its rows' own exits. */}
            <LayoutAnimationConfig skipExiting>
              <View collapsable={false} className="flex-1">
                <GroceryListSection scroll={scroll} state={listState} />
              </View>
            </LayoutAnimationConfig>
          </Animated.View>
        ) : (
          <Animated.View
            key="pantry"
            className="absolute inset-0"
            entering={PANTRY_IN}
            exiting={PANTRY_OUT}
          >
            <LayoutAnimationConfig skipExiting>
              <View collapsable={false} className="flex-1">
                <PantrySection pantry={pantry} scroll={scroll} />
              </View>
            </LayoutAnimationConfig>
          </Animated.View>
        )}
      </LayoutAnimationConfig>
      {/* Rows dissolve into the page colour before the tab bar. */}
      <View
        className="to-background from-background/0 absolute inset-x-0 bottom-0 h-[190px] bg-linear-to-b to-75%"
        pointerEvents="none"
      />
    </View>
  );
}
