// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  uploadGalleryImageData: vi.fn(),
  deleteGalleryImage: vi.fn(async () => undefined),
  unreadable: false,
}));

vi.mock("react-native", () => ({ Alert: { alert: vi.fn() } }));
vi.mock("react-intl", () => ({ useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }) }));
vi.mock("expo-file-system", () => ({
  File: class {
    constructor(readonly uri: string) {
      if (server.unreadable) throw new Error("No such file");
    }
  },
}));
vi.mock("@norish/shared-react/offline/react", () => ({
  useConnectivity: () => ({ isOffline: false }),
}));
vi.mock("@norish/shared-react/recipes", () => ({
  useRecipeImages: () => ({
    uploadGalleryImageData: server.uploadGalleryImageData,
    deleteGalleryImage: server.deleteGalleryImage,
  }),
  useRecipeVideos: () => ({ deleteGalleryVideo: vi.fn() }),
}));
vi.mock("@norish/shared/lib/upload-form", () => ({ uploadForm: (fields: object) => fields }));

const { useEditorUploads } = await import("../hooks/use-editor-uploads");

const photo = { uri: "file:///photo.heic" } as Parameters<
  ReturnType<typeof useEditorUploads>["uploadGallery"]
>[0][number];

describe("useEditorUploads", () => {
  beforeEach(() => {
    server.unreadable = false;
    server.uploadGalleryImageData.mockReset();
  });

  it("releases Save when a photo cannot be read", async () => {
    server.unreadable = true;
    const { result } = renderHook(() => useEditorUploads("r1"));

    await act(async () => {
      await result.current.uploadGallery([photo], 0);
    });

    expect(result.current.isUploading).toBe(false);
  });

  it("releases Save when the reader removes a photo whose upload hangs, and drops its answer", async () => {
    const answer = Promise.withResolvers<object>();

    server.uploadGalleryImageData.mockReturnValue(answer.promise);
    const { result } = renderHook(() => useEditorUploads("r1"));
    let added: unknown[] = [];

    act(() => {
      void result.current.uploadGallery([photo], 0).then((photos) => (added = photos));
    });
    expect(result.current.isUploading).toBe(true);
    const [pending] = result.current.pendingFor("gallery");

    act(() => result.current.cancel(pending!.key));
    expect(result.current.isUploading).toBe(false);
    await act(async () => answer.resolve({ success: true, url: "/r1/a.jpg", id: "img-1" }));

    expect(added).toEqual([]);
    expect(server.deleteGalleryImage).toHaveBeenCalledWith("img-1", 1);
  });
});
