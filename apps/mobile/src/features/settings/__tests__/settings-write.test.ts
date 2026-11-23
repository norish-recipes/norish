import { afterEach, describe, expect, it, vi } from "vitest";

import {
  guardRepeat,
  guardWrite,
  listenForNoAnswer,
  SETTINGS_WRITE_TIMEOUT_MS,
} from "../utils/settings-write";

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

  it("passes the press's arguments through and hands back what the write returns", () => {
    const send = vi.fn((choice: string) => Promise.resolve(choice));
    const write = guardWrite(() => false, send);

    expect(write("metric")).toBeInstanceOf(Promise);
    expect(send).toHaveBeenCalledExactlyOnceWith("metric");
    expect(guardWrite(() => true, send)("metric")).toBeUndefined();
  });
});

const deferred = () => {
  let resolve: (sent: boolean) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<boolean>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

describe("guardRepeat", () => {
  it("sends a repeat made while one is in flight never, and hands it the held outcome", async () => {
    const first = deferred();
    const send = vi.fn(() => first.promise);
    const write = guardRepeat("regenerate", send);

    const sent = write();
    const repeat = write();

    expect(send).toHaveBeenCalledTimes(1);
    first.resolve(true);
    await expect(repeat).resolves.toBe(true);
    await expect(sent).resolves.toBe(true);
    await write();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("keys kicks per member, and a failed kick's retry goes while another kick is in flight", async () => {
    const requests: ReturnType<typeof deferred>[] = [];
    const kick = (userId: string) =>
      guardRepeat(`kick:${userId}`, () => {
        const request = deferred();

        requests.push(request);

        return request.promise;
      })();

    const a = kick("a");

    void kick("b");
    expect(requests).toHaveLength(2);
    requests[0]?.reject(new Error("failed"));
    await expect(a).rejects.toThrow("failed");

    void kick("a");
    void kick("b");
    expect(requests).toHaveLength(3);
    requests[1]?.resolve(true);
    requests[2]?.resolve(false);
  });

  it("frees the key after a failure, a thrown error and an Offline refusal", async () => {
    const send = vi.fn(() => Promise.resolve(false));

    await expect(guardRepeat("leave", send)()).resolves.toBe(false);
    await expect(
      guardRepeat("leave", () => {
        throw new Error("thrown");
      })()
    ).rejects.toThrow("thrown");
    await expect(
      guardRepeat(
        "leave",
        guardWrite(() => true, send)
      )()
    ).resolves.toBeUndefined();
    await guardRepeat("leave", send)();
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe("an unanswered write", () => {
  afterEach(() => vi.useRealTimers());

  it("is released after the timeout as not gone through, told, and frees its key", async () => {
    vi.useFakeTimers();
    const told = vi.fn();
    const stopListening = listenForNoAnswer(told);
    const requests: ReturnType<typeof deferred>[] = [];
    const send = vi.fn(() => {
      const request = deferred();

      requests.push(request);

      return request.promise;
    });
    const write = guardRepeat("create", send, "createNoAnswer");

    const sent = write();

    await vi.advanceTimersByTimeAsync(SETTINGS_WRITE_TIMEOUT_MS - 1);
    expect(told).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(sent).resolves.toBeUndefined();
    expect(told).toHaveBeenCalledExactlyOnceWith("createNoAnswer");

    const retry = write();

    expect(send).toHaveBeenCalledTimes(2);
    // The first's late answer leaves the retry holding the key.
    requests[0]?.resolve(true);
    await vi.advanceTimersByTimeAsync(0);
    void write();
    expect(send).toHaveBeenCalledTimes(2);
    requests[1]?.resolve(false);
    await expect(retry).resolves.toBe(false);
    expect(told).toHaveBeenCalledOnce();
    stopListening();
  });
});
