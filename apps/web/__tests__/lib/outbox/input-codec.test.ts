import { describe, expect, it } from "vitest";

import {
  decodeOutboxInput,
  encodeOutboxInput,
  isEncodedFormData,
} from "@/lib/outbox/input-codec";

function entriesOf(formData: FormData): Array<[string, FormDataEntryValue]> {
  return [...formData.entries()];
}

describe("encodeOutboxInput", () => {
  it("encodes FormData as a tagged, ordered entry list", () => {
    const formData = new FormData();

    formData.append("id", "11111111-1111-4111-8111-111111111111");
    formData.append("name", "Pasta");

    const encoded = encodeOutboxInput(formData);

    expect(isEncodedFormData(encoded)).toBe(true);
    if (!isEncodedFormData(encoded)) throw new Error("unreachable");
    expect(encoded.entries).toEqual([
      ["id", "11111111-1111-4111-8111-111111111111"],
      ["name", "Pasta"],
    ]);
  });

  it("preserves duplicate keys and entry order", () => {
    const formData = new FormData();

    formData.append("tag", "one");
    formData.append("name", "Pasta");
    formData.append("tag", "two");

    const encoded = encodeOutboxInput(formData);

    if (!isEncodedFormData(encoded)) throw new Error("expected encoded FormData");
    expect(encoded.entries.map(([key]) => key)).toEqual(["tag", "name", "tag"]);
    expect(encoded.entries[0]?.[1]).toBe("one");
    expect(encoded.entries[2]?.[1]).toBe("two");
  });

  it("keeps File values intact", async () => {
    const formData = new FormData();
    const file = new File(["hello"], "photo.jpg", { type: "image/jpeg" });

    formData.append("image", file);

    const encoded = encodeOutboxInput(formData);

    if (!isEncodedFormData(encoded)) throw new Error("expected encoded FormData");
    const stored = encoded.entries[0]?.[1];

    expect(stored).toBeInstanceOf(File);
    expect((stored as File).name).toBe("photo.jpg");
    expect((stored as File).type).toBe("image/jpeg");
    await expect((stored as File).text()).resolves.toBe("hello");
  });

  it("structured-clones plain inputs so later mutation does not leak in", () => {
    const input = { id: "g1", nested: { amount: 1 } };
    const encoded = encodeOutboxInput(input) as typeof input;

    input.nested.amount = 99;

    expect(encoded).not.toBe(input);
    expect(encoded.nested.amount).toBe(1);
  });
});

describe("decodeOutboxInput", () => {
  it("reconstructs FormData with order and duplicates preserved", () => {
    const formData = new FormData();
    const file = new File(["x"], "a.png", { type: "image/png" });

    formData.append("tag", "one");
    formData.append("file", file);
    formData.append("tag", "two");

    const decoded = decodeOutboxInput(encodeOutboxInput(formData));

    expect(decoded).toBeInstanceOf(FormData);
    const entries = entriesOf(decoded as FormData);

    expect(entries.map(([key]) => key)).toEqual(["tag", "file", "tag"]);
    expect(entries[0]?.[1]).toBe("one");
    expect(entries[2]?.[1]).toBe("two");
    expect((entries[1]?.[1] as File).name).toBe("a.png");
  });

  it("passes non-encoded values through unchanged", () => {
    const input = { id: "g1" };

    expect(decodeOutboxInput(input)).toBe(input);
    expect(decodeOutboxInput("plain")).toBe("plain");
    expect(decodeOutboxInput(null)).toBeNull();
  });
});
