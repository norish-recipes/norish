import type { VideoPlayer } from "expo-video";
import React, { useState } from "react";
import { Image, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { GestureDetector, useTapGesture } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { GlassIconButton } from "@/components/glass";
import { lightImpact } from "@/lib/haptics";
import { useServerImage } from "@/lib/network/server-url";
import { useVideoPlayer, VideoView } from "expo-video";
import { useIntl } from "react-intl";

import type { FullRecipeDTO } from "@norish/shared/contracts";

import type { Item } from "../utils/hero-items";
import { heroItems } from "../utils/hero-items";

export const HERO_HEIGHT = 430;

/** The player is a native object, so it is set from outside the component. */
const muteVideo = (player: VideoPlayer, muted: boolean) => {
  player.muted = muted;
};

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

/** The hero's last 52% dissolves into the page, so the title sits on the ground. */
function Fade({ color }: { color: string }) {
  return (
    <View className="absolute inset-x-0 bottom-0 h-[210px]" pointerEvents="none">
      <Svg height="100%" width="100%">
        <Defs>
          <LinearGradient id="fade" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0" />
            <Stop offset="1" stopColor={color} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#fade)" height="100%" width="100%" />
      </Svg>
    </View>
  );
}

function Pill({ children }: { children: string }) {
  return (
    <View className="bg-background/70 h-[26px] justify-center rounded-full px-2.5">
      <Text className="text-foreground text-[13px] font-semibold">{children}</Text>
    </View>
  );
}

/** A video that plays in place once started; before that its poster and a play button. */
function VideoPage({
  item,
  width,
  pageColor,
}: {
  item: Extract<Item, { kind: "video" }>;
  width: number;
  pageColor: string;
}) {
  const intl = useIntl();
  const toImage = useServerImage();
  const [started, setStarted] = useState(false);

  return (
    <View style={{ width, height: HERO_HEIGHT }}>
      {item.poster ? (
        <Image
          resizeMode="cover"
          source={toImage(item.poster)}
          style={{ width, height: HERO_HEIGHT }}
        />
      ) : (
        <View className="bg-default" style={{ width, height: HERO_HEIGHT }} />
      )}
      {started ? (
        <Player item={item} width={width} />
      ) : (
        <View className="absolute inset-x-0 top-[166px] items-center">
          <GlassIconButton
            label={intl.formatMessage({ id: "recipes.carousel.videoPlayer.play" })}
            symbol="play.fill"
            testID="recipe-video-play"
            onPress={() => setStarted(true)}
          />
        </View>
      )}
      <Fade color={pageColor} />
    </View>
  );
}

function Player({ item, width }: { item: Extract<Item, { kind: "video" }>; width: number }) {
  const intl = useIntl();
  const toImage = useServerImage();
  const insets = useSafeAreaInsets();
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [view, setView] = useState<VideoView | null>(null);
  const player = useVideoPlayer(toImage(item.path), (created) => {
    created.muted = true;
    created.loop = true;
    created.play();
  });

  return (
    <>
      <VideoView
        ref={setView}
        contentFit="cover"
        nativeControls={false}
        player={player}
        style={{ position: "absolute", width, height: HERO_HEIGHT }}
      />
      <View className="absolute inset-x-0 top-[166px] items-center">
        <GlassIconButton
          label={intl.formatMessage({
            id: playing
              ? "recipes.carousel.videoPlayer.pause"
              : "recipes.carousel.videoPlayer.play",
          })}
          symbol={playing ? "pause.fill" : "play.fill"}
          testID="recipe-video-toggle"
          onPress={() => {
            if (playing) player.pause();
            else player.play();
            setPlaying(!playing);
          }}
        />
      </View>
      <View className="absolute top-[322px] left-5">
        <GlassIconButton
          label={intl.formatMessage({
            id: muted ? "recipes.carousel.videoPlayer.unmute" : "recipes.carousel.videoPlayer.mute",
          })}
          symbol={muted ? "speaker.slash.fill" : "speaker.wave.2.fill"}
          testID="recipe-video-mute"
          onPress={() => {
            muteVideo(player, !muted);
            setMuted(!muted);
          }}
        />
      </View>
      <View className="absolute left-[68px]" style={{ top: insets.top + 6 }}>
        <GlassIconButton
          label={intl.formatMessage({ id: "recipes.carousel.videoPlayer.fullscreen" })}
          symbol="arrow.up.left.and.arrow.down.right"
          testID="recipe-video-fullscreen"
          onPress={() => void view?.enterFullscreen()}
        />
      </View>
      {item.duration ? (
        <View className="absolute top-[330px] right-5">
          <Pill>{clock(item.duration)}</Pill>
        </View>
      ) : null}
    </>
  );
}

/** The recipe's photo, its gallery paged with dots, or its video, fading into the page; a double
 * tap favourites with a light haptic. */
export function RecipeHero({
  recipe,
  pageColor,
  onDoubleTap,
}: {
  recipe: Pick<FullRecipeDTO, "images" | "videos" | "name">;
  pageColor: string;
  onDoubleTap?: () => void;
}) {
  const intl = useIntl();
  const toImage = useServerImage();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const items = heroItems(recipe);
  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    runOnJS: true,
    onActivate: () => {
      if (!onDoubleTap) return;
      lightImpact();
      onDoubleTap();
    },
  });

  if (items.length === 0) {
    return (
      <View
        className="bg-default"
        style={{ height: HERO_HEIGHT - 120 }}
        testID="recipe-photo-empty"
      />
    );
  }

  return (
    <GestureDetector gesture={doubleTap}>
      <View style={{ height: HERO_HEIGHT }} testID="recipe-hero">
        <ScrollView
          horizontal
          pagingEnabled
          scrollEnabled={items.length > 1}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) =>
            setPage(Math.round(event.nativeEvent.contentOffset.x / width))
          }
        >
          {items.map((item) =>
            item.kind === "image" ? (
              <View key={item.key} style={{ width, height: HERO_HEIGHT }}>
                <Image
                  accessibilityLabel={recipe.name}
                  resizeMode="cover"
                  source={toImage(item.path)}
                  style={{ width, height: HERO_HEIGHT }}
                  testID="recipe-photo"
                />
                <Fade color={pageColor} />
              </View>
            ) : (
              <VideoPage key={item.key} item={item} pageColor={pageColor} width={width} />
            )
          )}
        </ScrollView>
        {items.length > 1 ? (
          <View
            accessibilityLabel={intl.formatMessage(
              { id: "recipes.carousel.photoOf" },
              { current: page + 1, total: items.length }
            )}
            className="bg-background/60 absolute top-[330px] h-6 flex-row items-center gap-[7px] self-center rounded-xl px-2.5"
            testID="recipe-dots"
          >
            {items.map((item, index) => (
              <View
                key={item.key}
                className="bg-foreground size-[7px] rounded-full"
                style={{ opacity: index === page ? 1 : 0.3 }}
              />
            ))}
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}
