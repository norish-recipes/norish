import { Directory, File, Paths } from "expo-file-system";

export type AppearanceMode = "light" | "dark" | "system";

const APPEARANCE_DIRECTORY = new Directory(Paths.document, "preferences");
const APPEARANCE_FILE = new File(APPEARANCE_DIRECTORY, "appearance-mode.json");

type AppearanceFilePayload = {
  mode: AppearanceMode;
};

function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === "light" || value === "dark" || value === "system";
}

export async function loadAppearanceMode(): Promise<AppearanceMode> {
  try {
    if (!APPEARANCE_FILE.exists) {
      return "system";
    }

    const content = await APPEARANCE_FILE.text();
    const parsed = JSON.parse(content) as Partial<AppearanceFilePayload>;

    if (isAppearanceMode(parsed.mode)) {
      return parsed.mode;
    }

    return "system";
  } catch {
    return "system";
  }
}

export function saveAppearanceMode(mode: AppearanceMode): void {
  if (!APPEARANCE_DIRECTORY.exists) {
    APPEARANCE_DIRECTORY.create({ idempotent: true, intermediates: true });
  }

  if (!APPEARANCE_FILE.exists) {
    APPEARANCE_FILE.create({ intermediates: true, overwrite: true });
  }

  APPEARANCE_FILE.write(JSON.stringify({ mode }));
}
