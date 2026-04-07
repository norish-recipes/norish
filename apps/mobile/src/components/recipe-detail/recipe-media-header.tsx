import type { MediaItem } from "@/lib/recipes/map-recipe-to-media-items";
import type { ViewToken } from "react-native";
import React, { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { NoImagePlaceholder } from "@/components/shared/no-image-placeholder";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEvent } from "expo";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";

import { MediaCarouselModal } from "./media-carousel-modal";

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  media: MediaItem[];
  liked: boolean;
  onDoubleTapLike: () => void;
};

// ─── Animation constants ─────────────────────────────────────────────────────

/** Duration of the initial pop-in phase (ms) */
const POP_IN_DURATION = 300;
/** Hold at full size before flying (ms) */
const HOLD_DURATION = 150;
/** Duration of the flight arc towards the like button (ms) */
const FLIGHT_DURATION = 320;
/** Total animation = pop-in + hold + flight */
const TOTAL_BEFORE_FLIGHT = POP_IN_DURATION + HOLD_DURATION;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Full-bleed media header that supports swiping through images & video.
 *
 * - **Images** – tap to open a full-screen carousel modal
 * - **Video**  – inline playback with custom controls, PiP & fullscreen
 * - **Double-tap** toggles like with an Instagram-style heart that pops in at
 *   center, then traces a curved arc towards the like-button icon — rotating
 *   as if pulled towards its destination.
 */
export function RecipeMediaHeader({ media, liked, onDoubleTapLike }: Props) {
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [errorIndices, setErrorIndices] = useState<Set<number>>(new Set());

  const handleSlideError = useCallback((index: number) => {
    setErrorIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);
  const [carouselStartIndex, setCarouselStartIndex] = useState(0);

  // Double-tap tracking
  const lastTap = useRef(0);
  const DOUBLE_TAP_DELAY = 300;

  // ── Heart animation shared values ──────────────────────────────────────────
  // The heart is absolutely positioned at the center of the media area.
  // We animate scale, opacity, translateX/Y, and rotation to trace an arc
  // from center → the RecipeLikedButton (top-right of the content area,
  // approximately at x = width - 32, y = headerHeight + some offset).
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const heartTranslateX = useSharedValue(0);
  const heartTranslateY = useSharedValue(0);
  const heartRotate = useSharedValue(0); // degrees

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: heartTranslateX.value },
      { translateY: heartTranslateY.value },
      { scale: heartScale.value },
      { rotate: `${heartRotate.value}deg` },
    ],
    opacity: heartOpacity.value,
  }));

  const triggerLikeAnimation = useCallback(
    (isCurrentlyLiked: boolean) => {
      if (isCurrentlyLiked) {
        // Unliking — just a light tap, no animation
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // ── Reset all values ───────────────────────────────────────────────
      heartTranslateX.value = 0;
      heartTranslateY.value = 0;
      heartRotate.value = 0;
      heartScale.value = 0;
      heartOpacity.value = 0;

      // ── Target offsets ─────────────────────────────────────────────────
      // Heart starts at left: 20, top: 58% of header (60px icon, center at ~50px).
      // Like button is at right side of title row: ~width - 28.
      const headerH = height * 0.6;
      const heartCenterX = 20 + 30; // left offset + half of 60px icon
      const targetX = width - 28 - heartCenterX; // fly all the way right
      const targetY = headerH * 0.32; // fly downward towards the like button

      const flightEasing = Easing.bezier(0.3, 0.0, 0.6, 1.0);

      // ── Scale: pop in → hold → shrink to match like button icon ────────
      heartScale.value = withSequence(
        // Phase 1: spring pop-in (smaller initial appearance)
        withSpring(1.0, { damping: 8, stiffness: 400, mass: 0.6 }),
        // Phase 2: hold briefly at full size
        withTiming(1.0, { duration: HOLD_DURATION }),
        // Phase 3: shrink to ~24px (like button icon size: 24/60 ≈ 0.4)
        withTiming(0.4, { duration: FLIGHT_DURATION, easing: flightEasing })
      );

      // ── Opacity: fade in → stay visible → snap off at end ──────────────
      heartOpacity.value = withSequence(
        withTiming(1, { duration: POP_IN_DURATION * 0.6 }),
        // Stay visible for the rest of pop-in + hold + most of flight
        withTiming(1, {
          duration: POP_IN_DURATION * 0.4 + HOLD_DURATION + FLIGHT_DURATION - 60,
        }),
        // Snap invisible
        withTiming(0, { duration: 60 })
      );

      // ── X translation: fly right towards the like button ───────────────
      // Ease-in curve (slow start, accelerates — "pulled" towards target)
      heartTranslateX.value = withDelay(
        TOTAL_BEFORE_FLIGHT,
        withTiming(targetX, {
          duration: FLIGHT_DURATION,
          easing: Easing.bezier(0.2, 0.0, 0.7, 1.0),
        })
      );

      // ── Y translation: fly downward (positive) with ease-in ────────────
      // Starts slow, accelerates down — like being pulled by gravity
      heartTranslateY.value = withDelay(
        TOTAL_BEFORE_FLIGHT,
        withTiming(targetY, {
          duration: FLIGHT_DURATION,
          easing: Easing.bezier(0.3, 0.0, 0.8, 1.0),
        })
      );

      // ── Rotation: tilts clockwise as it flies down-right ───────────────
      heartRotate.value = withDelay(
        TOTAL_BEFORE_FLIGHT,
        withTiming(15, { duration: FLIGHT_DURATION, easing: flightEasing })
      );
    },
    [heartScale, heartOpacity, heartTranslateX, heartTranslateY, heartRotate, width, height]
  );

  const handlePress = useCallback(
    (index: number) => {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_DELAY) {
        // Double tap detected
        triggerLikeAnimation(liked);
        onDoubleTapLike();
        lastTap.current = 0;
      } else {
        lastTap.current = now;
        // Single tap – open carousel for non-errored images only
        const item = media[index];
        if (item?.type === "image" && !errorIndices.has(index)) {
          setTimeout(() => {
            if (lastTap.current !== 0) {
              const imageIndices = media
                .map((m, i) => (m.type === "image" && !errorIndices.has(i) ? i : -1))
                .filter((i) => i >= 0);
              const imageOnlyIdx = imageIndices.indexOf(index);
              setCarouselStartIndex(imageOnlyIdx >= 0 ? imageOnlyIdx : 0);
              setCarouselVisible(true);
              lastTap.current = 0;
            }
          }, DOUBLE_TAP_DELAY + 50);
        }
      }
    },
    [media, liked, errorIndices, triggerLikeAnimation, onDoubleTapLike]
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const imageOnlyMedia = media.filter(
    (m, i): m is Extract<MediaItem, { type: "image" }> => m.type === "image" && !errorIndices.has(i)
  );

  return (
    <View className="absolute inset-0">
      {media.length === 0 ? (
        <NoImagePlaceholder variant="header" />
      ) : (
        <FlatList
          data={media}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `media-${i}`}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item, index }) => (
            <MediaSlide
              item={item}
              index={index}
              width={width}
              hasError={errorIndices.has(index)}
              onSlideError={handleSlideError}
              onPress={() => handlePress(index)}
            />
          )}
        />
      )}

      {/* Heart overlay — starts left-side, lower in media, arcs to like button */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: "58%",
            left: 20,
            width: 60,
            height: 60,
            alignItems: "center",
            justifyContent: "center",
          },
          heartAnimatedStyle,
        ]}
      >
        <Ionicons name="heart" size={60} color="#ff375f" />
      </Animated.View>

      {/* Pagination dots */}
      {media.length > 1 && (
        <PaginationDots count={media.length} active={activeIndex} media={media} />
      )}

      {/* Full-screen image carousel modal */}
      {media.length > 0 && (
        <MediaCarouselModal
          visible={carouselVisible}
          images={imageOnlyMedia.map((m) => m.uri)}
          startIndex={carouselStartIndex}
          onClose={() => setCarouselVisible(false)}
        />
      )}
    </View>
  );
}

// ─── Individual slide ────────────────────────────────────────────────────────

function MediaSlide({
  item,
  index,
  width,
  hasError,
  onSlideError,
  onPress,
}: {
  item: MediaItem;
  index: number;
  width: number;
  hasError: boolean;
  onSlideError: (index: number) => void;
  onPress: () => void;
}) {
  const handleError = useCallback(() => {
    onSlideError(index);
  }, [index, onSlideError]);

  if (item.type === "video") {
    return (
      <View style={{ width }}>
        <VideoSlide item={item} width={width} onDoubleTap={onPress} />
      </View>
    );
  }

  if (hasError) {
    return (
      <Pressable onPress={onPress} style={{ width }}>
        <NoImagePlaceholder variant="header" />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={{ width }}>
      <Image
        source={{ uri: item.uri }}
        contentFit="cover"
        transition={400}
        style={StyleSheet.absoluteFill}
        onError={handleError}
      />
    </Pressable>
  );
}

// ─── Video slide ─────────────────────────────────────────────────────────────

function VideoSlide({
  item,
  width,
  onDoubleTap,
}: {
  item: Extract<MediaItem, { type: "video" }>;
  width: number;
  onDoubleTap: () => void;
}) {
  const videoRef = useRef<VideoView>(null);
  const player = useVideoPlayer(item.uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, player]);

  const handleFullscreen = useCallback(() => {
    videoRef.current?.enterFullscreen();
  }, []);

  const handlePiP = useCallback(() => {
    videoRef.current?.startPictureInPicture();
  }, []);

  return (
    <View style={{ width, height: "100%" }}>
      {/* Poster image behind the video */}
      {item.posterUri && (
        <Image
          source={{ uri: item.posterUri }}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Video player */}
      <VideoView
        ref={videoRef}
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture
      />

      {/* Transparent tap target for double-tap detection */}
      <Pressable onPress={onDoubleTap} className="absolute inset-0" style={{ zIndex: 1 }} />

      {/* Video controls — lower, just above the gradient zone */}
      <View
        className="absolute right-3 left-3 flex-row items-center justify-between"
        style={{ bottom: "25%", zIndex: 2 }}
      >
        <Pressable
          onPress={handlePlayPause}
          hitSlop={8}
          className="size-11 items-center justify-center rounded-full bg-black/50"
        >
          <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="#fff" />
        </Pressable>

        <View className="flex-row gap-2">
          <Pressable
            onPress={handlePiP}
            hitSlop={8}
            className="size-11 items-center justify-center rounded-full bg-black/50"
          >
            <Ionicons name="albums-outline" size={18} color="#fff" />
          </Pressable>
          <Pressable
            onPress={handleFullscreen}
            hitSlop={8}
            className="size-11 items-center justify-center rounded-full bg-black/50"
          >
            <Ionicons name="expand-outline" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Pagination dots ─────────────────────────────────────────────────────────

function PaginationDots({
  count,
  active,
  media,
}: {
  count: number;
  active: number;
  media: MediaItem[];
}) {
  return (
    <View
      className="absolute right-0 left-0 flex-row items-center justify-center gap-1.5"
      style={{ bottom: "22%" }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          className={`items-center justify-center rounded ${
            i === active ? "size-2 bg-white" : "size-1.5 bg-white/45"
          }`}
        >
          {media[i]?.type === "video" && <Ionicons name="videocam" size={6} color="#fff" />}
        </View>
      ))}
    </View>
  );
}
