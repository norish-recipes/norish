import type { PropsWithChildren, ReactElement } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colorKit, useThemeColor } from "heroui-native";

type Props = PropsWithChildren<{
  /** Simple single-image hero (legacy) */
  headerImage?: ReactElement;
  /** Rich multi-media hero (images + video) – takes precedence over headerImage */
  headerMedia?: ReactElement;
  scrollEnabled?: boolean;
}>;

/**
 * Parallax scroll view adapted from the HeroUI Native cooking-onboarding
 * example. Renders a full-bleed hero image that gently fades into the page
 * background via a linear gradient, with parallax scaling on overscroll.
 */
export function ParallaxScrollView({ children, headerImage, headerMedia, scrollEnabled }: Props) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const themeColorBackground = useThemeColor("background");

  // Hero takes up ~50% of the screen height
  const headerHeight = height * 0.6;

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollOffset.get(), [-headerHeight, 0, headerHeight / 2], [1, 1, 0]),
      transform: [
        {
          translateY: interpolate(
            scrollOffset.get(),
            [-headerHeight, 0, headerHeight],
            [-headerHeight / 2, 0, headerHeight * 0.75]
          ),
        },
        {
          scale: interpolate(scrollOffset.get(), [-headerHeight, 0, headerHeight], [2, 1, 1]),
        },
      ],
    };
  });

  return (
    <Animated.ScrollView
      ref={scrollRef}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      scrollEnabled={scrollEnabled}
      style={{ backgroundColor: themeColorBackground }}
    >
      <Animated.View style={[{ height: headerHeight, overflow: "hidden" }, headerAnimatedStyle]}>
        {headerMedia ?? headerImage}
        <LinearGradient
          colors={[
            colorKit.setAlpha(themeColorBackground, 0).hex(),
            colorKit.setAlpha(themeColorBackground, 0.6).hex(),
            themeColorBackground,
          ]}
          locations={[0, 0.5, 1]}
          style={styles.gradient}
        />
      </Animated.View>
      <View className="z-50 -mt-[100px] flex-1 overflow-hidden p-4">{children}</View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    pointerEvents: "none",
  },
});
