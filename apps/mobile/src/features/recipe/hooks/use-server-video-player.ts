import type { VideoPlayer } from "expo-video";
import { useServerImage } from "@/lib/network/server-url";
import { useVideoPlayer } from "expo-video";

/** A player for a video the server stores, sent the session cookie as an image is. */
export function useServerVideoPlayer(path: string, setup: (player: VideoPlayer) => void) {
  const toSource = useServerImage();

  return useVideoPlayer(toSource(path), setup);
}
