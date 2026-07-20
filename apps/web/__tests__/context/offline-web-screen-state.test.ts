import { shouldShowOfflineWebLoading } from "@/context/offline-web/shared";

describe("offline web screen state", () => {
  it("keeps existing screen skeletons visible while fallback records load", () => {
    expect(shouldShowOfflineWebLoading("loading-fallback", false, false)).toBe(true);
    expect(shouldShowOfflineWebLoading("probing-live", true, false)).toBe(true);
    expect(shouldShowOfflineWebLoading("cached", false, false, true)).toBe(true);
    expect(shouldShowOfflineWebLoading("cached", false, false)).toBe(false);
  });

  it("does not cover resolved live data while another fallback scan runs", () => {
    expect(shouldShowOfflineWebLoading("loading-fallback", false, true)).toBe(false);
    expect(shouldShowOfflineWebLoading("loading-fallback", true, true)).toBe(false);
    expect(shouldShowOfflineWebLoading("probing-live", true, true)).toBe(true);
  });
});
