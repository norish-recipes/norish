/**
 * Video processing form: the upload format. Only a generic OpenAI-compatible
 * endpoint can be a server that reads nothing but WAV, so only it offers the
 * choice, and the stored choice survives a save of any other field.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

const updateVideoConfig = vi.fn();
const context = vi.hoisted(() => ({ videoConfig: undefined as unknown }));

vi.mock("@/app/(app)/settings/admin/context", () => ({
  useAdminSettingsContext: () => ({
    videoConfig: context.videoConfig,
    aiConfig: { enabled: true },
    updateVideoConfig,
    fetchConfigSecret: vi.fn(),
  }),
}));

vi.mock("@/hooks/admin", () => ({
  useAvailableTranscriptionModelsQuery: () => ({ models: [], refusal: null, isLoading: false }),
  useYtDlpVersionQuery: () => ({ version: "2026.08.19", error: null, isLoading: false }),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const { default: VideoProcessingForm } =
  await import("@/app/(app)/settings/admin/components/video-processing-form");

const genericConfig = {
  enabled: true,
  maxLengthSeconds: 120,
  maxVideoFileSize: 100 * 1024 * 1024,
  transcriptionProvider: "generic-openai",
  transcriptionEndpoint: "http://localhost:8000",
  transcriptionModel: "qwen3-asr",
};

describe("VideoProcessingForm upload format", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    context.videoConfig = genericConfig;
  });

  it("is offered for a generic OpenAI-compatible endpoint", () => {
    render(<VideoProcessingForm />);

    expect(screen.getAllByText("transcriptionAudioFormat").length).toBeGreaterThan(0);
  });

  it("is not offered for a cloud provider, which always reads MP3", () => {
    context.videoConfig = {
      ...genericConfig,
      transcriptionProvider: "openai",
      transcriptionEndpoint: undefined,
      transcriptionApiKey: "••••••••",
      transcriptionModel: "whisper-1",
    };
    render(<VideoProcessingForm />);

    expect(screen.queryByText("transcriptionAudioFormat")).not.toBeInTheDocument();
  });

  it("keeps a stored WAV choice when another field is saved", () => {
    context.videoConfig = { ...genericConfig, transcriptionAudioFormat: "wav" };
    render(<VideoProcessingForm />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "maxLength" }), {
      target: { value: "90" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    expect(updateVideoConfig).toHaveBeenCalledWith(
      expect.objectContaining({ maxLengthSeconds: 90, transcriptionAudioFormat: "wav" })
    );
  });

  it("saves MP3 for a config stored before the setting existed", () => {
    render(<VideoProcessingForm />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "maxLength" }), {
      target: { value: "90" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    expect(updateVideoConfig).toHaveBeenCalledWith(
      expect.objectContaining({ transcriptionAudioFormat: "mp3" })
    );
  });
});
