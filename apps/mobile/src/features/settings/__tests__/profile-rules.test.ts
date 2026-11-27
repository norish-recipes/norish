import { describe, expect, it, vi } from "vitest";

import type { DraftState } from "../utils/draft-rules";
import { canSave, isEdited, keptDraft, shownDraft } from "../utils/draft-rules";
import { NAME_DRAFT, saveProfile } from "../utils/profile-rules";

const base: DraftState<string> = { draft: null, saved: "Ada", saving: false, offline: false };
const sent = (draft: string | null, saved: string) =>
  isEdited(NAME_DRAFT, draft, saved) && draft !== null ? NAME_DRAFT.sent(draft) : null;

describe("the name field", () => {
  it("shows the saved name until something is typed, and the draft after", () => {
    expect(shownDraft(null, "Ada")).toBe("Ada");
    expect(shownDraft("Eve", "Ada")).toBe("Eve");
  });

  it("shows a name from another device when nothing is typed, and keeps a draft over it", () => {
    expect(shownDraft(null, "Grace")).toBe("Grace");
    expect(shownDraft("Eve", "Grace")).toBe("Eve");
  });

  it("sends the trimmed draft, and nothing when trimming leaves the saved name", () => {
    expect(sent(null, "Ada")).toBeNull();
    expect(sent(" Eve ", "Ada")).toBe("Eve");
    expect(sent("Ada ", "Ada")).toBeNull();
    expect(sent("   ", "Ada")).toBe("");
  });

  it("sends a draft that now differs because another device renamed", () => {
    expect(sent("Ada", "Grace")).toBe("Ada");
  });
});

describe("a draft that would send nothing", () => {
  const kept = (draft: string | null, { saved = "Ada", editing = false, saving = false } = {}) =>
    keptDraft(NAME_DRAFT, draft, saved, editing || saving);

  it("is dropped once the field is left, so a later rename shows", () => {
    expect(kept("Ada ")).toBeNull();
    expect(kept("Grace", { saved: "Grace" })).toBeNull();
  });

  it("stays while the reader is typing and while a save is in flight", () => {
    expect(kept("Ada ", { editing: true })).toBe("Ada ");
    expect(kept("Ada ", { saving: true })).toBe("Ada ");
  });

  it("stays when it would send something, an empty name included", () => {
    expect(kept("Eve")).toBe("Eve");
    expect(kept("")).toBe("");
    expect(kept(null)).toBeNull();
  });
});

describe("the save", () => {
  type Photo = { uri: string };
  const sent: Photo = { uri: "a" };

  /** The form's staged name and photo, written through as the component's setters do. */
  function form(draft: string | null, photo: Photo | null) {
    const staged = { draft, photo };
    const connection = { offline: false };
    const updateName = vi.fn<(name: string) => Promise<boolean>>();
    const uploadAvatar = vi.fn<(photo: Photo) => Promise<boolean>>();
    const save = () =>
      saveProfile({
        draft,
        savedName: "Ada",
        photo,
        updateName,
        uploadAvatar,
        setDraft: (update) => (staged.draft = update(staged.draft)),
        setPhoto: (update) => (staged.photo = update(staged.photo)),
        offline: () => connection.offline,
      });

    return { staged, connection, updateName, uploadAvatar, save };
  }

  it("sends the trimmed name, then the photo, and drops both once taken", async () => {
    const { staged, updateName, uploadAvatar, save } = form(" Eve ", sent);

    updateName.mockResolvedValue(true);
    uploadAvatar.mockResolvedValue(true);
    await save();

    expect(updateName).toHaveBeenCalledExactlyOnceWith("Eve");
    expect(uploadAvatar).toHaveBeenCalledExactlyOnceWith(sent);
    expect(vi.mocked(updateName)).toHaveBeenCalledBefore(vi.mocked(uploadAvatar));
    expect(staged).toEqual({ draft: null, photo: null });
  });

  it("sends nothing when Offline as Save runs", async () => {
    const { staged, connection, updateName, uploadAvatar, save } = form("Eve", sent);

    connection.offline = true;
    await save();

    expect(updateName).not.toHaveBeenCalled();
    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(staged).toEqual({ draft: "Eve", photo: sent });
  });

  it("keeps the photo staged when Offline begins after the name went through", async () => {
    const { staged, connection, updateName, uploadAvatar, save } = form("Eve", sent);

    updateName.mockImplementation(async () => {
      connection.offline = true;
      return true;
    });
    await save();

    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(staged).toEqual({ draft: null, photo: sent });
  });

  it("stops at a name that was refused or stale, leaving the name and the photo staged", async () => {
    const { staged, updateName, uploadAvatar, save } = form("Eve", sent);

    updateName.mockResolvedValue(false);
    await save();

    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(staged).toEqual({ draft: "Eve", photo: sent });
  });

  it("keeps the photo staged when its upload fails after the name went through", async () => {
    const { staged, updateName, uploadAvatar, save } = form("Eve", sent);

    updateName.mockResolvedValue(true);
    uploadAvatar.mockResolvedValue(false);
    await save();

    expect(staged).toEqual({ draft: null, photo: sent });
  });

  it("sends only the photo when the name is unchanged", async () => {
    const { staged, updateName, uploadAvatar, save } = form("Ada ", sent);

    uploadAvatar.mockResolvedValue(true);
    await save();

    expect(updateName).not.toHaveBeenCalled();
    expect(staged).toEqual({ draft: "Ada ", photo: null });
  });

  it("sends only the name when no photo waits", async () => {
    const { staged, updateName, uploadAvatar, save } = form("Eve", null);

    updateName.mockResolvedValue(true);
    await save();

    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(staged).toEqual({ draft: null, photo: null });
  });

  it("keeps text typed and a photo picked while the save was in flight", async () => {
    const later: Photo = { uri: "b" };
    const { staged, updateName, uploadAvatar, save } = form("Eve", sent);
    const name = Promise.withResolvers<boolean>();
    const upload = Promise.withResolvers<boolean>();

    updateName.mockReturnValue(name.promise);
    uploadAvatar.mockReturnValue(upload.promise);
    const saved = save();

    staged.draft = "Eve Smith";
    name.resolve(true);
    await vi.waitFor(() => expect(uploadAvatar).toHaveBeenCalled());
    staged.photo = later;
    upload.resolve(true);
    await saved;

    expect(staged).toEqual({ draft: "Eve Smith", photo: later });
  });
});

describe("saving the profile", () => {
  const can = (state: Partial<DraftState<string>>, photo = false) =>
    canSave(NAME_DRAFT, { ...base, ...state }, photo);

  it("needs a changed name or a new photo", () => {
    expect(can({})).toBe(false);
    expect(can({ draft: "Eve" })).toBe(true);
    expect(can({}, true)).toBe(true);
    expect(can({ draft: "Eve" }, true)).toBe(true);
  });

  it("is off for an edit that only adds whitespace, unless a photo waits", () => {
    expect(can({ draft: "Ada  " })).toBe(false);
    expect(can({ draft: "Ada  " }, true)).toBe(true);
  });

  it("stays on for an empty name, which the save refuses and says why", () => {
    expect(can({ draft: "" })).toBe(true);
  });

  it("is off while saving and while Offline", () => {
    expect(can({ draft: "Eve", saving: true })).toBe(false);
    expect(can({ draft: "Eve", offline: true })).toBe(false);
  });
});
