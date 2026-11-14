import type { ShareInbox } from "@/lib/offline/share-inbox";
import { Directory, File, Paths } from "expo-file-system";

/** The Share Extension's `share-inbox` folder in the App Group; null off iOS or before it exists. */
export function appGroupInbox(): ShareInbox | null {
  const [container] = Object.values(Paths.appleSharedContainers);
  const folder = container && new Directory(container, "share-inbox");

  if (!folder?.exists) return null;
  const file = (name: string) => new File(folder, name);

  return {
    ids: () =>
      folder
        .list()
        .filter((entry): entry is File => entry instanceof File && entry.name.endsWith(".json"))
        .sort((a, b) => (a.creationTime ?? 0) - (b.creationTime ?? 0))
        .map((entry) => entry.name.slice(0, -".json".length)),
    read: async (id) => {
      const json = file(`${id}.json`);

      return json.exists ? json.text() : null;
    },
    image: (name) => {
      const image = file(name);

      return image.exists ? image : null;
    },
    remove: (id) => {
      // The JSON goes last, so an interrupted removal is found and finished next time.
      for (const entry of folder.list()) {
        if (entry.name.startsWith(`${id}-`)) entry.delete();
      }
      const json = file(`${id}.json`);

      // A Sign-out's discard may have removed it while the drain was importing it.
      if (json.exists) json.delete();
    },
  };
}
