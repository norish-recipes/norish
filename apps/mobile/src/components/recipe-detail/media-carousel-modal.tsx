import type { ViewToken } from "react-native";
import React, { useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassView } from "expo-glass-effect";
import { Image } from "expo-image";

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  images: string[];
  startIndex?: number;
  onClose: () => void;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Full-screen image carousel modal with swipe navigation, counter,
 * and a liquid-glass close button.
 */
export function MediaCarouselModal({ visible, images, startIndex = 0, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const flatListRef = useRef<FlatList>(null);

  // Reset active index when the modal opens with a new start position
  React.useEffect(() => {
    if (visible) {
      setActiveIndex(startIndex);
    }
  }, [visible, startIndex]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/95">
        {/* Header bar */}
        <View
          className="absolute top-0 right-0 left-0 z-10 flex-row items-center justify-between px-4 pb-3"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Text className="text-[15px] font-semibold text-white">
            {activeIndex + 1} / {images.length}
          </Text>

          {/* Liquid-glass close button — GlassView needs explicit style, not className */}
          <Pressable onPress={onClose} hitSlop={12}>
            <GlassView style={styles.glassCloseBtn}>
              <Ionicons name="close" size={20} color="#fff" />
            </GlassView>
          </Pressable>
        </View>

        {/* Image carousel */}
        <FlatList
          ref={flatListRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `carousel-${i}`}
          initialScrollIndex={startIndex}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item }) => (
            <View
              style={{
                width,
                height,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Image
                source={{ uri: item }}
                contentFit="contain"
                style={{ width, height: height * 0.75 }}
                transition={200}
              />
            </View>
          )}
        />

        {/* Bottom pagination bar */}
        <View
          className="absolute right-0 bottom-0 left-0 flex-row items-center justify-center gap-1.5"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {images.map((_, i) => (
            <View
              key={i}
              className={`rounded ${
                i === activeIndex ? "size-2 bg-white" : "size-1.5 bg-white/40"
              }`}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  glassCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
});
