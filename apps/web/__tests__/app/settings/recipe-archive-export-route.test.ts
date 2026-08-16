// @vitest-environment node

import { GET } from "@/app/(app)/export/recipes/route";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.hoisted(() => vi.fn());
const buildArchiveMock = vi.hoisted(() => vi.fn());
const householdMock = vi.hoisted(() => vi.fn());

vi.mock("@norish/auth/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock("@norish/shared-server/archive/norish-export", () => ({
  buildNorishArchiveForViewer: buildArchiveMock,
}));

vi.mock("@norish/shared-server/cache/household", () => ({
  getCachedHouseholdForUser: householdMock,
}));

vi.mock("@norish/shared-server/logger", () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function signedInAs(user: {
  id: string;
  name?: string | null;
  isServerAdmin?: boolean;
  isServerOwner?: boolean;
}) {
  getSessionMock.mockResolvedValue({ user });
}

function exportRequest(query = ""): Request {
  return new Request(`http://localhost/export/recipes${query}`);
}

/** The viewer context the export service was asked with. */
function requestedContext() {
  return buildArchiveMock.mock.calls[0]?.[0]?.ctx;
}

describe("Recipe Archive export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    householdMock.mockResolvedValue(null);
    buildArchiveMock.mockResolvedValue({ zip: new JSZip(), recipeCount: 0 });
  });

  it("refuses a signed-out request", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await GET(exportRequest());

    expect(response.status).toBe(401);
    expect(buildArchiveMock).not.toHaveBeenCalled();
  });

  it("streams a dated .norishrecipes attachment for a signed-in user", async () => {
    signedInAs({ id: "user-1", name: "Ada" });

    const response = await GET(exportRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="norish-recipes-\d{4}-\d{2}-\d{2}\.norishrecipes"$/
    );
    expect(response.body).toBeTruthy();
  });

  it("asks the visibility layer with the household the viewer belongs to", async () => {
    signedInAs({ id: "user-1" });
    householdMock.mockResolvedValue({ users: [{ id: "user-1" }, { id: "user-2" }] });

    await GET(exportRequest());

    expect(requestedContext()).toEqual({
      userId: "user-1",
      householdUserIds: ["user-1", "user-2"],
      isServerAdmin: false,
    });
  });

  it("refuses the instance-wide scope for a non-admin, whatever the UI shows", async () => {
    signedInAs({ id: "user-1" });

    const response = await GET(exportRequest("?scope=instance"));

    expect(response.status).toBe(403);
    expect(buildArchiveMock).not.toHaveBeenCalled();
  });

  it("resolves the instance-wide scope to everything for a server admin", async () => {
    signedInAs({ id: "admin-1", isServerAdmin: true });

    const response = await GET(exportRequest("?scope=instance"));

    expect(response.status).toBe(200);
    expect(requestedContext()?.isServerAdmin).toBe(true);
  });

  it("gives an admin the same reach from the user doorway, by design", async () => {
    // The scope is "everything the exporter can see", and an admin's library
    // already shows them everything — so the admin button is discoverability,
    // not privileged extra data (ADR-0022). Pinned because it looks like an
    // authorisation leak until you know it is the decision.
    signedInAs({ id: "admin-1", isServerAdmin: true });

    await GET(exportRequest());

    expect(requestedContext()?.isServerAdmin).toBe(true);
  });

  it("grants the instance-wide scope to the server owner too", async () => {
    signedInAs({ id: "owner-1", isServerOwner: true });

    const response = await GET(exportRequest("?scope=instance"));

    expect(response.status).toBe(200);
    expect(requestedContext()?.isServerAdmin).toBe(true);
  });

  it("produces the same format and mechanics for both doorways", async () => {
    signedInAs({ id: "admin-1", isServerAdmin: true });

    const viewer = await GET(exportRequest());

    vi.clearAllMocks();
    signedInAs({ id: "admin-1", isServerAdmin: true });
    householdMock.mockResolvedValue(null);
    buildArchiveMock.mockResolvedValue({ zip: new JSZip(), recipeCount: 0 });

    const instance = await GET(exportRequest("?scope=instance"));

    expect(instance.headers.get("Content-Type")).toBe(viewer.headers.get("Content-Type"));
    expect(instance.headers.get("Content-Disposition")).toBe(
      viewer.headers.get("Content-Disposition")
    );
  });

  it("ignores an unrecognised scope instead of widening it", async () => {
    signedInAs({ id: "user-1" });

    const response = await GET(exportRequest("?scope=everything"));

    expect(response.status).toBe(200);
    expect(requestedContext()?.isServerAdmin).toBe(false);
  });
});
