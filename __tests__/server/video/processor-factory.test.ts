// @vitest-environment node
import type { VideoProcessor, VideoProcessorContext } from "@/server/video/types";

import { describe, it, expect, beforeEach } from "vitest";

import { VideoProcessorFactory } from "@/server/video/processor-factory";

// Mock processor for testing
class MockProcessor implements VideoProcessor {
  readonly name = "MockProcessor";

  async process(_context: VideoProcessorContext) {
    return {
      id: "test-id",
      name: "Test Recipe",
      description: "Test description",
      ingredients: [],
      instructions: [],
    } as never;
  }
}

describe("VideoProcessorFactory", () => {
  let factory: VideoProcessorFactory;

  beforeEach(() => {
    factory = new VideoProcessorFactory();
  });

  describe("registerProcessor", () => {
    it("registers a processor for a platform", () => {
      const processor = new MockProcessor();

      factory.registerProcessor("youtube", processor);

      const result = factory.getProcessor("https://www.youtube.com/watch?v=ABC123");

      expect(result).toBe(processor);
    });
  });

  describe("getProcessor", () => {
    it("returns registered processor for Instagram URLs", () => {
      const processor = new MockProcessor();

      factory.registerProcessor("instagram", processor);

      const result = factory.getProcessor("https://www.instagram.com/p/ABC123/");

      expect(result).toBe(processor);
    });

    it("returns registered processor for Facebook URLs", () => {
      const processor = new MockProcessor();

      factory.registerProcessor("facebook", processor);

      const result = factory.getProcessor("https://www.facebook.com/watch?v=123");

      expect(result).toBe(processor);
    });

    it("returns registered processor for YouTube URLs", () => {
      const processor = new MockProcessor();

      factory.registerProcessor("youtube", processor);

      const result = factory.getProcessor("https://www.youtube.com/watch?v=ABC123");

      expect(result).toBe(processor);
    });

    it("returns generic processor for unknown platforms", () => {
      const genericProcessor = new MockProcessor();

      factory.registerProcessor("generic", genericProcessor);

      const result = factory.getProcessor("https://www.tiktok.com/@user/video/123");

      expect(result).toBe(genericProcessor);
    });

    it("throws error when no processor registered for platform", () => {
      expect(() => {
        factory.getProcessor("https://www.youtube.com/watch?v=ABC123");
      }).toThrow("No processor registered for platform: youtube");
    });

    it("throws error when no generic fallback registered", () => {
      expect(() => {
        factory.getProcessor("https://www.tiktok.com/@user/video/123");
      }).toThrow("No processor registered for platform: generic");
    });
  });

  describe("hasProcessor", () => {
    it("returns true when processor is registered", () => {
      factory.registerProcessor("youtube", new MockProcessor());
      expect(factory.hasProcessor("youtube")).toBe(true);
    });

    it("returns false when processor is not registered", () => {
      expect(factory.hasProcessor("youtube")).toBe(false);
    });
  });
});
