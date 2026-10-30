// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const readSessionPrincipal = vi.hoisted(() => vi.fn());
const canAccessResource = vi.hoisted(() => vi.fn());
const isUserServerAdmin = vi.hoisted(() => vi.fn());
const getCachedHouseholdForUser = vi.hoisted(() => vi.fn());

vi.mock("@norish/auth/session", () => ({ readSessionPrincipal }));
vi.mock("@norish/auth/permissions", () => ({ canAccessResource }));
vi.mock("@norish/db", () => ({ isUserServerAdmin }));
vi.mock("@norish/shared-server/cache/household", () => ({ getCachedHouseholdForUser }));

const { refuseUnlessViewer } = await import("@/lib/auth/media-session");

describe("refuseUnlessViewer", () => {
  const req = new Request("http://norish.test/recipes/x/a.jpg");
  const owner = async () => "owner-id";

  beforeEach(() => {
    readSessionPrincipal.mockResolvedValue({ userId: "reader-id" });
    getCachedHouseholdForUser.mockResolvedValue({ users: [{ id: "reader-id" }] });
    canAccessResource.mockResolvedValue(false);
    isUserServerAdmin.mockResolvedValue(false);
  });

  it("answers a reader without a session as if the file were missing", async () => {
    readSessionPrincipal.mockResolvedValue(null);

    const refused = await refuseUnlessViewer(req, owner);

    expect(refused?.status).toBe(404);
    expect(refused?.headers.get("Cache-Control")).toBe("no-store");
  });

  it("answers a signed-in reader who may not open the recipe as if the file were missing", async () => {
    const refused = await refuseUnlessViewer(req, owner);

    expect(canAccessResource).toHaveBeenCalledWith(
      "view",
      "reader-id",
      "owner-id",
      ["reader-id"],
      false
    );
    expect(refused?.status).toBe(404);
  });

  it("serves a reader the permission policy lets in, and a server admin", async () => {
    canAccessResource.mockResolvedValueOnce(true);
    expect(await refuseUnlessViewer(req, owner)).toBeNull();

    isUserServerAdmin.mockResolvedValueOnce(true);
    expect(await refuseUnlessViewer(req, owner)).toBeNull();
  });

  it("serves a file nobody owns: an orphaned recipe, or one not saved yet", async () => {
    expect(await refuseUnlessViewer(req, async () => null)).toBeNull();
    expect(canAccessResource).not.toHaveBeenCalled();
  });
});
