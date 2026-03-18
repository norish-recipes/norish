export function hasDocumentFullscreenApi(doc: Document): boolean {
  return Boolean(
    doc.fullscreenEnabled ||
    (doc as Document & { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled ||
    (doc as Document & { mozFullScreenEnabled?: boolean }).mozFullScreenEnabled ||
    (doc as Document & { msFullscreenEnabled?: boolean }).msFullscreenEnabled
  );
}

export function hasNativeVideoFullscreen(video: HTMLVideoElement | null): boolean {
  if (!video) {
    return false;
  }

  const nativeVideo = video as HTMLVideoElement & {
    webkitEnterFullscreen?: () => Promise<void> | void;
    webkitSupportsFullscreen?: boolean;
  };

  return Boolean(
    typeof nativeVideo.webkitEnterFullscreen === "function" || nativeVideo.webkitSupportsFullscreen
  );
}

export function isFullscreenControlSupported(
  doc: Document,
  video: HTMLVideoElement | null
): boolean {
  return hasDocumentFullscreenApi(doc) || hasNativeVideoFullscreen(video);
}
