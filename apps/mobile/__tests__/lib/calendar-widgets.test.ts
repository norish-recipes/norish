import type { SmallWidgetProps, WidgetStrings } from "@/lib/calendar-widgets-state";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { dateKey } from "@norish/shared/lib/helpers";

type Entry = { date: Date; props: SmallWidgetProps };

const native = vi.hoisted(() => ({
  small: vi.fn<(entries: { date: Date; props: unknown }[]) => void>(),
  large: vi.fn<(entries: { date: Date; props: unknown }[]) => void>(),
  // The shared folder's files by name.
  folder: new Set<string>(),
  downloads: [] as string[],
  failDownload: false,
}));

const warn = vi.hoisted(() => vi.fn());
vi.mock("@norish/shared/lib/logger", () => ({ createClientLogger: () => ({ warn }) }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, PixelRatio: { get: () => 3 } }));
vi.mock("@expo/ui/swift-ui", () => ({}));
vi.mock("@expo/ui/swift-ui/modifiers", () => ({}));
vi.mock("expo-linking", () => ({ createURL: (path: string) => `norish://${path.slice(1)}` }));
vi.mock("@/lib/network/server-address", () => ({ getServerAddress: () => "https://norish.test" }));
vi.mock("@/lib/auth/auth-headers", () => ({ authHeaders: () => ({ Cookie: "session" }) }));
vi.mock("expo-widgets", () => ({
  widgetsDirectory: "file:///group/ExpoWidgets/",
  createWidget: (name: string) => ({
    updateTimeline: name === "CalendarMeal" ? native.small : native.large,
  }),
}));
vi.mock("expo-file-system", () => {
  class FakeFile {
    name: string;
    uri: string;
    inFolder: boolean;
    constructor(parent: { uri: string } | string, name: string) {
      this.name = name;
      this.inFolder = typeof parent !== "string" && parent.uri === "file:///group/ExpoWidgets/";
      this.uri = `${typeof parent === "string" ? parent : parent.uri}${name}`;
    }
    get exists() {
      return this.inFolder && native.folder.has(this.name);
    }
    delete() {
      native.folder.delete(this.name);
    }
    move(target: FakeFile) {
      native.folder.add(target.name);
    }
    static downloadFileAsync = async (url: string) => {
      native.downloads.push(url);
      if (native.failDownload) throw new Error("offline");
    };
  }
  class FakeDirectory {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    list() {
      return [...native.folder].map((name) => new FakeFile(this, name));
    }
  }

  return { Directory: FakeDirectory, File: FakeFile, Paths: { cache: "file:///cache/" } };
});
vi.mock("expo-image-manipulator", () => {
  const image = {
    width: 1200,
    height: 800,
    saveAsync: async () => ({ uri: "file:///cache/saved.jpg" }),
  };
  const context = { crop: () => context, resize: () => context, renderAsync: async () => image };

  return { ImageManipulator: { manipulate: () => context }, SaveFormat: { JPEG: "jpeg" } };
});

const { clearCalendarWidgets, startCalendarWidgets, syncCalendarWidgets } =
  await import("@/lib/calendar-widgets");

const strings: WidgetStrings = {
  nothingPlanned: "Nothing planned",
  signIn: "Open Norish to sign in",
  open: "Open Norish",
  calendar: "Calendar",
  today: "Today",
  untitled: "Untitled",
  slots: { Breakfast: "Breakfast", Lunch: "Lunch", Dinner: "Dinner", Snack: "Snack" },
  more: (count) => `+${count} more`,
  weekday: () => "Sunday",
  weekdayShort: () => "Sun",
};

const today = new Date();
const key = dateKey(today);

function planned(
  slot: PlannedItemFromQuery["slot"],
  name: string,
  image: string | null
): PlannedItemFromQuery {
  return {
    id: name,
    userId: "user",
    date: key,
    slot,
    sortOrder: 0,
    itemType: "recipe",
    recipeId: name,
    title: null,
    recipeName: name,
    recipeImage: image,
    servings: null,
    calories: null,
    version: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

// A snack is shown at any hour, so the small widget's first entry shows it whatever the time.
const plan = (image: string | null = "/recipes/a/one.jpg") => ({
  [key]: [planned("Snack", "Popcorn", image)],
});
const firstSmall = (call: number) =>
  (native.small.mock.calls[call]?.[0] as Entry[] | undefined)?.[0]?.props;

describe("syncCalendarWidgets", () => {
  beforeEach(async () => {
    await clearCalendarWidgets("Signed out");
    startCalendarWidgets();
    native.small.mockClear();
    native.large.mockClear();
    native.folder.clear();
    native.downloads.length = 0;
    native.failDownload = false;
    warn.mockClear();
  });

  it("pushes without the photo first, then again once it is in the shared folder", async () => {
    await syncCalendarWidgets(plan(), strings);

    expect(native.small).toHaveBeenCalledTimes(2);
    expect(firstSmall(0)).toMatchObject({ name: "Popcorn" });
    expect(firstSmall(0)).not.toHaveProperty("photo");
    expect(firstSmall(1)).toMatchObject({
      photo: "file:///group/ExpoWidgets/_recipes_a_one_jpg-meal.jpg",
    });
    expect(native.downloads).toEqual(["https://norish.test/recipes/a/one.jpg"]);
    expect([...native.folder].sort()).toEqual([
      "_recipes_a_one_jpg-meal.jpg",
      "_recipes_a_one_jpg-thumb.jpg",
    ]);
  });

  it("skips a push when the widgets would show the same", async () => {
    await syncCalendarWidgets(plan(null), strings);
    await syncCalendarWidgets(plan(null), strings);

    expect(native.small).toHaveBeenCalledTimes(1);
    expect(native.large).toHaveBeenCalledTimes(1);
  });

  it("removes photos no longer shown", async () => {
    await syncCalendarWidgets(plan(), strings);
    await syncCalendarWidgets(plan("/recipes/a/two.jpg"), strings);

    expect([...native.folder].sort()).toEqual([
      "_recipes_a_two_jpg-meal.jpg",
      "_recipes_a_two_jpg-thumb.jpg",
    ]);
  });

  it("keeps a photo that failed to download for the next sync, pushing once", async () => {
    native.failDownload = true;
    await syncCalendarWidgets(plan(), strings);

    expect(native.small).toHaveBeenCalledTimes(1);
    expect(native.downloads).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
  });

  it("bounds the photos it writes", async () => {
    // Three photographed recipes on each of the 20 days read: more than the folder holds.
    const many: Record<string, PlannedItemFromQuery[]> = {};

    for (let offset = 0; offset < 20; offset++) {
      const date = dateKey(
        new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
      );

      many[date] = (["Breakfast", "Lunch", "Dinner"] as const).map((slot) => ({
        ...planned("Snack", `${date}-${slot}`, `/recipes/${date}/${slot}.jpg`),
        date,
        slot,
      }));
    }

    await syncCalendarWidgets(many, strings);

    expect(native.folder.size).toBe(60);
  });
});

describe("clearCalendarWidgets", () => {
  it("leaves the signed-out line, removes every photo and drops a sync that comes after", async () => {
    startCalendarWidgets();
    await syncCalendarWidgets(plan(), strings);
    native.small.mockClear();

    await clearCalendarWidgets();
    await syncCalendarWidgets(plan("/recipes/b/late.jpg"), strings);

    expect(native.small).toHaveBeenCalledTimes(1);
    expect(native.small.mock.calls[0]?.[0]).toEqual([
      {
        date: new Date(0),
        props: { kind: "message", text: "Open Norish to sign in", url: "norish://" },
      },
    ]);
    expect(native.folder.size).toBe(0);
  });
});
