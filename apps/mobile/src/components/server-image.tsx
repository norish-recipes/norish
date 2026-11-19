import type { ComponentProps } from "react";
import React from "react";
import { useServerImage } from "@/lib/network/server-url";
import { Image } from "expo-image";
import { withUniwind } from "uniwind";

const ClassImage = withUniwind(Image);

/** A picture on the server, from the memory and disk cache once seen; `path` is its address there.
 * Keyed by `path`, so a recycled list cell drops the last item's picture at once. */
export function ServerImage({
  path,
  ...props
}: Omit<ComponentProps<typeof ClassImage>, "source" | "cachePolicy"> & { path: string }) {
  const toImage = useServerImage();

  return (
    <ClassImage cachePolicy="memory-disk" recyclingKey={path} source={toImage(path)} {...props} />
  );
}
