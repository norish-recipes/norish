// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const picker = vi.hoisted(() => ({
  launchImageLibraryAsync: vi.fn(async () => ({ canceled: true, assets: null })),
  launchCameraAsync: vi.fn(async () => ({ canceled: true, assets: null })),
}));

vi.mock("react-native", () => ({ Alert: { alert: vi.fn() }, Linking: {} }));
vi.mock("react-intl", () => ({ useIntl: () => ({ formatMessage: () => "" }) }));
vi.mock("expo-device", () => ({ isDevice: true }));
vi.mock("@/hooks/use-cancel-button", () => ({ useCancelButton: () => ({ text: "Cancel" }) }));
vi.mock("expo-image-picker", () => ({
  ...picker,
  requestCameraPermissionsAsync: async () => ({ granted: true }),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: "compatible" },
}));

const { usePhotoPicker } = await import("@/hooks/use-photo-picker");

describe("usePhotoPicker", () => {
  it("asks the library for a photo the server takes, HEIC handed over as JPEG", async () => {
    const { result } = renderHook(() => usePhotoPicker());

    await result.current.pick("library", { mediaTypes: ["images"] }, vi.fn());

    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ["images"],
      preferredAssetRepresentationMode: "compatible",
    });
  });
});
