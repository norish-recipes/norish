import { describe, expect, it } from "vitest";

import { decodeMutationInput, encodeMutationInput } from "./payload-codecs";

describe("web outbox payload codecs", () => {
  it("round-trips SuperJSON transformed values", async () => {
    const input = {
      date: new Date("2026-07-10T00:00:00.000Z"),
      amount: 12n,
      values: new Map([["one", 1]]),
      missing: undefined,
    };
    const encoded = await encodeMutationInput(input);
    const decoded = decodeMutationInput(encoded.kind, encoded.serialized);

    expect(decoded).toEqual(input);
  });

  it("preserves ordered duplicate fields and binary file metadata", async () => {
    const input = new FormData();
    input.append("tag", "one");
    input.append("tag", "two");
    input.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "photo.bin", {
        type: "application/octet-stream",
        lastModified: 123,
      })
    );

    const encoded = await encodeMutationInput(input);
    const decoded = decodeMutationInput(encoded.kind, encoded.serialized) as FormData;
    const entries = [...(decoded as unknown as Iterable<[string, FormDataEntryValue]>)];

    expect(encoded.kind).toBe("form-data");
    expect(entries[0]).toEqual(["tag", "one"]);
    expect(entries[1]).toEqual(["tag", "two"]);
    expect(entries[2]?.[0]).toBe("file");
    expect(entries[2]?.[1]).toMatchObject({
      name: "photo.bin",
      type: "application/octet-stream",
      lastModified: 123,
    });
    expect(Array.from(new Uint8Array(await (entries[2]?.[1] as File).arrayBuffer()))).toEqual([
      1, 2, 3,
    ]);
  });
});
