import { describe, expect, it, vi } from "vitest";

import { guardWrite } from "../utils/settings-write";

describe("guardWrite", () => {
  it("asks for Offline when the write runs, not when it was made", () => {
    let offline = false;
    const send = vi.fn();
    const write = guardWrite(() => offline, send);

    offline = true;
    write();
    expect(send).not.toHaveBeenCalled();

    offline = false;
    write();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
