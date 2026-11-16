import React, { useEffect, useState } from "react";
import { Modal, ScrollView, Text, useWindowDimensions, View } from "react-native";
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { GlassCloseButton } from "@/components/glass";
import { SPRING } from "@/lib/motion/spring";
import { useServerImage } from "@/lib/network/server-url";
import { useVideoPlayer, VideoView } from "expo-video";

import type { Item } from "../utils/hero-items";
import { counterLabel, dismisses, pageAt } from "../utils/viewer-pages";
import { ZoomableImage } from "./zoomable-image";

const FADE_MS = 160;

function ViewerVideo({
  item,
  active,
}: {
  item: Extract<Item, { kind: "video" }>;
  active: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const toImage = useServerImage();
  const player = useVideoPlayer(toImage(item.path), (created) => {
    created.loop = true;
  });

  // Only the page in front plays; the pager keeps the others mounted.
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  return <VideoView contentFit="contain" player={player} style={{ width, height }} />;
}

/** Every item full screen, from `start`: swipe sideways between them, pinch an image to zoom, drag
 * down to let go. Both ways out run the same fade-and-fly before `onClose`. */
export function MediaViewer({
  items,
  start,
  label,
  onClose,
}: {
  items: Item[];
  start: number;
  label: string;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [page, setPage] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const dragY = useSharedValue(0);
  const fade = useSharedValue(1);

  const close = (velocity = 0) => {
    "worklet";
    const done = (finished?: boolean) => {
      "worklet";
      if (finished) scheduleOnRN(onClose);
    };

    if (reduceMotion) fade.set(withTiming(0, { duration: FADE_MS }, done));
    else dragY.set(withSpring(height, { ...SPRING, velocity }, done));
  };
  const pan = usePanGesture({
    enabled: !zoomed,
    activeOffsetY: [-12, 12],
    failOffsetX: [-20, 20],
    onUpdate: (event) => {
      "worklet";
      dragY.set(Math.max(0, event.translationY));
    },
    onDeactivate: (event) => {
      "worklet";
      if (dismisses(event.translationY, event.velocityY)) close(event.velocityY);
      else dragY.set(withSpring(0, { ...SPRING, velocity: event.velocityY }));
    },
  });
  const backdrop = useAnimatedStyle(() => ({
    opacity: fade.get() * (1 - Math.min(dragY.get() / (height * 0.6), 1)),
  }));
  const content = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ translateY: dragY.get() }],
  }));

  return (
    <Modal statusBarTranslucent transparent animationType="fade" onRequestClose={() => close()}>
      <GestureHandlerRootView className="flex-1">
        <Animated.View className="absolute inset-0 bg-black" style={backdrop} />
        <GestureDetector gesture={pan}>
          <Animated.View className="flex-1" style={content}>
            <ScrollView
              horizontal
              pagingEnabled
              contentOffset={{ x: start * width, y: 0 }}
              scrollEnabled={!zoomed && items.length > 1}
              showsHorizontalScrollIndicator={false}
              testID="media-viewer-pages"
              onMomentumScrollEnd={(event) =>
                setPage(pageAt(event.nativeEvent.contentOffset.x, width, items.length))
              }
            >
              {items.map((item, index) =>
                item.kind === "image" ? (
                  <ZoomableImage
                    key={item.key}
                    label={label}
                    path={item.path}
                    zoomed={zoomed && index === page}
                    onZoomed={setZoomed}
                  />
                ) : (
                  <ViewerVideo key={item.key} active={index === page} item={item} />
                )
              )}
            </ScrollView>
            <View
              className="absolute inset-x-0 flex-row items-center justify-between px-5"
              pointerEvents="box-none"
              style={{ top: insets.top + 6 }}
            >
              <View className="size-10" />
              <Text className="text-[17px] font-semibold text-white" testID="media-viewer-count">
                {counterLabel(page, items.length)}
              </Text>
              <GlassCloseButton
                color="#ffffff"
                testID="media-viewer-close"
                onPress={() => close()}
              />
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}
