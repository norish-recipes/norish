import type { MmkvLike, UploadFileStore } from "@/lib/offline/mmkv-storage";
import { createMmkvStorage } from "@/lib/offline/mmkv-storage";
import { describe, expect, it } from "vitest";

import type { NewOutboxEntry } from "@norish/shared-react/offline";
import { createOutboxStore } from "@norish/shared-react/offline";
import { describeOfflineStorageContract } from "@norish/shared-react/offline/testing";

type Upload = { uri: string; name: string; type: string };

/** The device's files: picked photos and the app's own copies, by uri. */
const disk = new Map<string, string>();
let picked = 0;

function fakeMmkv(): MmkvLike {
  const values = new Map<string, string | number | boolean | ArrayBuffer>();

  return {
    getString: (key) => {
      const value = values.get(key);

      return typeof value === "string" ? value : undefined;
    },
    getNumber: (key) => {
      const value = values.get(key);

      return typeof value === "number" ? value : undefined;
    },
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => values.delete(key),
    getAllKeys: () => [...values.keys()],
  };
}

function fakeFiles(container = "app"): UploadFileStore {
  const uri = (name: string) => `file:///${container}/outbox-uploads/${name}`;

  return {
    async copy(from, name) {
      const content = disk.get(from);

      if (content === undefined) {
        throw new Error(`no file at ${from}`);
      }

      disk.set(uri(name), content);
    },
    uri,
    delete: (name) => {
      disk.delete(uri(name));
    },
  };
}

function pickPhoto(text: string, name: string, type: string): Upload {
  const uri = `file:///picker/${(picked += 1)}-${name}`;

  disk.set(uri, text);

  return { uri, name, type };
}

describeOfflineStorageContract("MMKV (mobile)", {
  create: () => createMmkvStorage({ mmkv: fakeMmkv(), files: fakeFiles() }),
  makeBlob: pickPhoto,
  readBlob: async (value) => {
    const { uri, name, type } = value as Upload;
    const text = disk.get(uri);

    if (text === undefined) {
      throw new Error(`no file at ${uri}`);
    }

    return { text, name, type };
  },
});

function entry(overrides: Partial<NewOutboxEntry> = {}): NewOutboxEntry {
  return {
    id: "e",
    ownerId: "u1",
    path: "recipes.uploadImage",
    input: { id: "g1" },
    entityId: "g1",
    operationId: null,
    headers: {},
    ...overrides,
  };
}

const withPhoto = (photo: Upload) => ({
  codec: "norish-outbox/formdata@1",
  entries: [
    ["id", "r1"],
    ["image", photo],
  ],
});

const storedUpload = async (store: ReturnType<typeof createOutboxStore>) => {
  const [stored] = await store.loadAll();

  return (stored!.input as { entries: [string, Upload][] }).entries[1]![1];
};

describe("MMKV storage adapter", () => {
  it("keeps the upload after the picked original is gone", async () => {
    const store = createOutboxStore(
      createMmkvStorage({ mmkv: fakeMmkv(), files: fakeFiles() }).outbox
    );
    const photo = pickPhoto("jpeg-bytes", "photo.jpg", "image/jpeg");

    await store.enqueue(entry({ input: withPhoto(photo) }));
    disk.delete(photo.uri);

    const upload = await storedUpload(store);

    expect(upload).toMatchObject({ name: "photo.jpg", type: "image/jpeg" });
    expect(disk.get(upload.uri)).toBe("jpeg-bytes");
  });

  it("deletes the upload copy when its entry is removed", async () => {
    const store = createOutboxStore(
      createMmkvStorage({ mmkv: fakeMmkv(), files: fakeFiles() }).outbox
    );
    const queued = await store.enqueue(
      entry({ input: withPhoto(pickPhoto("jpeg-bytes", "photo.jpg", "image/jpeg")) })
    );
    const copy = (await storedUpload(store)).uri;

    await store.remove(queued.seq);

    expect(disk.has(copy)).toBe(false);
  });

  it("finds the upload copy after iOS moves the app's container", async () => {
    const mmkv = fakeMmkv();
    const before = createOutboxStore(createMmkvStorage({ mmkv, files: fakeFiles("old") }).outbox);

    await before.enqueue(
      entry({ input: withPhoto(pickPhoto("jpeg-bytes", "photo.jpg", "image/jpeg")) })
    );

    const moved = fakeFiles("new");
    const after = createOutboxStore(createMmkvStorage({ mmkv, files: moved }).outbox);
    const upload = await storedUpload(after);

    expect(upload.uri.startsWith("file:///new/")).toBe(true);
  });

  it("rejects the enqueue when MMKV cannot write, leaving no entry or copy", async () => {
    const mmkv = fakeMmkv();
    const failing: MmkvLike = {
      ...mmkv,
      set: (key, value) => {
        if (key.startsWith("outbox:")) {
          throw new Error("disk full");
        }

        mmkv.set(key, value);
      },
    };
    const store = createOutboxStore(
      createMmkvStorage({ mmkv: failing, files: fakeFiles() }).outbox
    );
    const before = disk.size;

    await expect(
      store.enqueue(entry({ input: withPhoto(pickPhoto("jpeg-bytes", "photo.jpg", "image/jpeg")) }))
    ).rejects.toThrow("disk full");
    expect(await store.size()).toBe(0);
    expect(disk.size).toBe(before + 1);
  });

  it("rejects the enqueue when the upload cannot be copied", async () => {
    const store = createOutboxStore(
      createMmkvStorage({ mmkv: fakeMmkv(), files: fakeFiles() }).outbox
    );
    const vanished = { uri: "file:///picker/missing.jpg", name: "missing.jpg", type: "image/jpeg" };

    await expect(store.enqueue(entry({ input: withPhoto(vanished) }))).rejects.toThrow();
    expect(await store.size()).toBe(0);
  });

  it("rejects an upload value it cannot keep by path", async () => {
    const store = createOutboxStore(
      createMmkvStorage({ mmkv: fakeMmkv(), files: fakeFiles() }).outbox
    );
    const input = { codec: "norish-outbox/formdata@1", entries: [["image", { bytes: 1 }]] };

    await expect(store.enqueue(entry({ input }))).rejects.toThrow();
    expect(await store.size()).toBe(0);
  });

  it("removes the entry when its copy cannot be deleted", async () => {
    const files = {
      ...fakeFiles(),
      delete: () => {
        throw new Error("file is busy");
      },
    };
    const store = createOutboxStore(createMmkvStorage({ mmkv: fakeMmkv(), files }).outbox);
    const queued = await store.enqueue(
      entry({ input: withPhoto(pickPhoto("jpeg-bytes", "photo.jpg", "image/jpeg")) })
    );

    await store.remove(queued.seq);

    expect(await store.size()).toBe(0);
  });

  it("shows a later entry only after an earlier upload's copy lands", async () => {
    let finishCopy = () => {};
    const slow = fakeFiles();
    const files = {
      ...slow,
      copy: (from: string, name: string) =>
        new Promise<void>((resolve) => (finishCopy = () => resolve(slow.copy(from, name)))),
    };
    const store = createOutboxStore(createMmkvStorage({ mmkv: fakeMmkv(), files }).outbox);

    const first = store.enqueue(
      entry({ input: withPhoto(pickPhoto("jpeg-bytes", "photo.jpg", "image/jpeg")) })
    );
    const second = store.enqueue(entry({ id: "later", input: { id: "g2" } }));

    await Promise.resolve();
    expect(await store.size()).toBe(0);

    finishCopy();
    await Promise.all([first, second]);

    expect((await store.loadAll()).map(({ id }) => id)).toEqual(["e", "later"]);
  });
});
