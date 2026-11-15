import { PixelRatio, Platform } from "react-native";
import { serverImage } from "@/lib/network/server-url";
import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { widgetsDirectory } from "expo-widgets";

import { createClientLogger } from "@norish/shared/lib/logger";

import type { PhotoLookup, PhotoSize } from "./calendar-widgets-state";
import { getServerAddress } from "./network/server-address";

const log = createClientLogger("calendar-widgets");

/** The most photos the shared folder holds; a later recipe shows without one. */
const MAX_PHOTOS = 60;
/** Each photo's side in points: the small widget's longest, the week's thumbnail. */
const PHOTO_POINTS: Record<PhotoSize, number> = { meal: 170, thumb: 20 };

/** A photo a widget shows: its server path, its file in the shared folder and the size it is cut to. */
type WidgetPhoto = { image: string; name: string; size: PhotoSize };

function photoFolder(): Directory | null {
  return Platform.OS === "ios" && widgetsDirectory ? new Directory(widgetsDirectory) : null;
}

/** A photo's file name, from its server path, which names its content, and its size. */
function photoName(image: string, size: PhotoSize) {
  return `${image.replace(/[^a-zA-Z0-9]/g, "_").slice(-120)}-${size}.jpg`;
}

/** Calls `render` with the photos on the device, removes those it left out, downloads those it
 * wants and renders again as each lands; once `current` turns false it stops and keeps nothing. */
export async function renderWithPhotos(
  render: (photo: PhotoLookup) => void,
  current: () => boolean,
  failed = new Set<string>()
): Promise<void> {
  if (!current()) return;
  const folder = photoFolder();
  const present = new Set(folder?.list().map((entry) => entry.name) ?? []);
  const wanted = new Map<string, WidgetPhoto>();

  render((image, size) => {
    const name = photoName(image, size);

    if (!folder || (!wanted.has(name) && wanted.size >= MAX_PHOTOS)) return null;
    wanted.set(name, { image, name, size });

    return present.has(name) ? new File(folder, name).uri : null;
  });
  if (!folder) return;
  for (const entry of folder.list()) if (!wanted.has(entry.name)) entry.delete();

  // Each missing photo is downloaded once for every size it is shown at.
  const missing = new Map<string, WidgetPhoto[]>();

  for (const photo of wanted.values()) {
    if (present.has(photo.name) || failed.has(photo.name)) continue;
    missing.set(photo.image, [...(missing.get(photo.image) ?? []), photo]);
  }
  let fetched = false;

  for (const [image, files] of missing) {
    if (!current()) return;
    if (await fetchPhoto(folder, image, files, current)) fetched = true;
    else files.forEach(({ name }) => failed.add(name));
  }
  if (fetched) await renderWithPhotos(render, current, failed);
}

/** Removes every photo from the shared folder. */
export function clearPhotos() {
  for (const entry of photoFolder()?.list() ?? []) entry.delete();
}

/** Downloads a photo, crops it square and scales it to each size's pixels: WidgetKit refuses larger. */
async function fetchPhoto(
  folder: Directory,
  image: string,
  files: WidgetPhoto[],
  current: () => boolean
): Promise<boolean> {
  const source = serverImage(getServerAddress(), image);
  const download = new File(Paths.cache, `widget-${files[0]?.name ?? "photo"}`);

  try {
    if (download.exists) download.delete();
    await File.downloadFileAsync(source.uri, download, { headers: source.headers });
    const original = await ImageManipulator.manipulate(download.uri).renderAsync();
    const side = Math.min(original.width, original.height);

    for (const { name, size } of files) {
      const pixels = Math.min(side, Math.round(PHOTO_POINTS[size] * PixelRatio.get()));
      const square = await ImageManipulator.manipulate(original)
        .crop({
          originX: (original.width - side) / 2,
          originY: (original.height - side) / 2,
          width: side,
          height: side,
        })
        .resize({ width: pixels, height: pixels })
        .renderAsync();
      const saved = await square.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

      // A session ended during the download: its photo is not the next session's to keep.
      if (!current()) {
        new File(saved.uri).delete();

        return false;
      }
      new File(saved.uri).move(new File(folder, name));
    }

    return true;
  } catch (error) {
    log.warn({ error }, "Could not fetch a calendar widget photo");

    return false;
  } finally {
    if (download.exists) download.delete();
  }
}
