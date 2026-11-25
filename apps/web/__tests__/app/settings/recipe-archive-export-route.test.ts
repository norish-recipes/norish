// @vitest-environment node

import { Readable } from "node:stream";
import { GET } from "@/app/(app)/export/recipes/route";
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

function signedInAs(user: { id: string; name?: string | null; isServerAdmin?: boolean }) {
  getSessionMock.mockResolvedValue({ user });
}

function exportRequest(query = ""): Request {
  return new Request(`http://localhost/export/recipes${query}`);
}

/** The viewer context the export service was asked with. */
const OWN_HOUSEHOLD = { id: "own-household", users: [] };

function requestedContext() {
  return buildArchiveMock.mock.calls[0]?.[0]?.ctx;
}

describe("Recipe Archive export route", () => {
  beforeEach(() => {
    householdMock.mockResolvedValue(OWN_HOUSEHOLD);
    buildArchiveMock.mockResolvedValue({ stream: Readable.from(["PK"]), recipeCount: 0 });
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
    householdMock.mockResolvedValue({
      id: "household-1",
      users: [{ id: "user-1" }, { id: "user-2" }],
    });

    await GET(exportRequest());

    expect(requestedContext()).toEqual({ userId: "user-1", householdId: "household-1" });
  });

  it("asks a server admin's export the same way, with no wider scope", async () => {
    signedInAs({ id: "admin-1", isServerAdmin: true });

    const response = await GET(exportRequest("?scope=instance"));

    expect(response.status).toBe(200);
    expect(requestedContext()).toEqual({ userId: "admin-1", householdId: "own-household" });
  });

  describe("authorisation probe", () => {
    it("answers a signed-in probe without building an archive", async () => {
      signedInAs({ id: "user-1" });

      const response = await GET(exportRequest("?probe=1"));

      expect(response.status).toBe(204);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      // The point of the probe: the expensive half never runs.
      expect(buildArchiveMock).not.toHaveBeenCalled();
      expect(householdMock).not.toHaveBeenCalled();
    });

    it("refuses a signed-out probe the same way the download would", async () => {
      getSessionMock.mockResolvedValue(null);

      const response = await GET(exportRequest("?probe=1"));

      expect(response.status).toBe(401);
    });

    it("still streams when no probe is asked for", async () => {
      signedInAs({ id: "user-1" });

      const response = await GET(exportRequest("?probe=0"));

      expect(response.status).toBe(200);
      expect(buildArchiveMock).toHaveBeenCalled();
    });
  });
});
