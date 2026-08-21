/**
 * Model listing: a provider that refuses must not read as a provider with
 * nothing to offer.
 *
 * Both used to arrive at the admin screen as an empty dropdown, which is how a
 * rejected API key came to look like a broken feature. These pin the two apart.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  listModels,
  listTranscriptionModels,
  ModelListingError,
} from "../../../src/ai/providers/listing";

const OPENAI_MODELS = {
  object: "list",
  data: [
    { id: "gpt-4o", object: "model" },
    { id: "whisper-1", object: "model" },
    { id: "gpt-4o-transcribe", object: "model" },
    { id: "gpt-4o-mini-transcribe", object: "model" },
    { id: "tts-1", object: "model" },
  ],
};

function stubFetch(response: Response | Error) {
  const mock = vi.fn(async () => {
    if (response instanceof Error) throw response;

    return response;
  });

  vi.stubGlobal("fetch", mock);

  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("transcription model listing", () => {
  it("returns the provider's audio models", async () => {
    stubFetch(new Response(JSON.stringify(OPENAI_MODELS), { status: 200 }));

    const models = await listTranscriptionModels("openai", { apiKey: "sk-test" });

    expect(models.map((m) => m.id)).toEqual([
      "gpt-4o-mini-transcribe",
      "gpt-4o-transcribe",
      "whisper-1",
    ]);
  });

  it("reports a rejected key rather than an empty list", async () => {
    stubFetch(new Response("{}", { status: 401, statusText: "Unauthorized" }));

    await expect(listTranscriptionModels("openai", { apiKey: "sk-stale" })).rejects.toThrow(
      ModelListingError
    );
  });

  it("names the provider the way the admin screen does", async () => {
    stubFetch(new Response("{}", { status: 401, statusText: "Unauthorized" }));

    const refusal = await listTranscriptionModels("openai", { apiKey: "sk-stale" }).catch(
      (error: unknown) => error as ModelListingError
    );

    expect(refusal.provider).toBe("OpenAI");
    expect(refusal.status).toBe(401);
    expect(refusal.statusText).toBe("Unauthorized");
  });

  it("reports an unreachable endpoint with no status", async () => {
    stubFetch(new TypeError("fetch failed"));

    const refusal = await listTranscriptionModels("generic-openai", {
      endpoint: "http://localhost:9999",
    }).catch((error: unknown) => error as ModelListingError);

    expect(refusal).toBeInstanceOf(ModelListingError);
    expect(refusal.status).toBeUndefined();
  });

  it("still says nothing is configured with an empty list", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));

    await expect(listTranscriptionModels("openai", {})).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("chat model listing", () => {
  it("reports a rejected key rather than an empty list", async () => {
    stubFetch(new Response("{}", { status: 401, statusText: "Unauthorized" }));

    await expect(listModels("openai", { apiKey: "sk-stale" })).rejects.toThrow(ModelListingError);
  });

  it("still says nothing is configured with an empty list", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));

    await expect(listModels("openai", {})).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
