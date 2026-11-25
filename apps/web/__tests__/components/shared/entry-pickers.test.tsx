import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { EntryComboBox } from "@/components/shared/entry-combo-box";
import TagPicker from "@/components/shared/tag-picker";
import ProvenanceFields, {
  EMPTY_PROVENANCE_FORM_VALUE,
} from "@/features/recipes/components/editor/provenance-fields";

const mocks = vi.hoisted(() => ({
  entries: [] as { id: string; name: string }[],
  created: vi.fn(),
  offline: false,
  readFor: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(" ")}` : key,
  useLocale: () => "en",
}));

// The shared hook is tested in shared-react; here it is the list and a create that answers.
vi.mock("@norish/shared-react/lists", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/shared-react/lists")>();

  return {
    ...actual,
    useListEntries: (kind: string, recipeId?: string) => {
      mocks.readFor(kind, recipeId);

      return { entries: mocks.entries, isLoading: false };
    },
    useEntryPicker: ({
      kind,
      recipeId,
      typed,
      isSelected,
      onSelect,
    }: Parameters<typeof actual.useEntryPicker>[0]) => {
      const offer = actual.createOffer(kind, mocks.entries, typed);

      mocks.readFor(kind, recipeId);

      return {
        isLoading: false,
        matches: actual.matchEntries(
          kind,
          mocks.entries.filter((entry) => !isSelected(entry)),
          typed
        ),
        offer,
        isOffline: mocks.offline,
        createDisabled: mocks.offline,
        isCreating: false,
        createFailed: false,
        createAndSelect: async () => {
          if (offer.kind !== "create" || mocks.offline) return;
          mocks.created(offer.name);
          onSelect({ id: `new-${offer.name}`, name: offer.name });
        },
      };
    },
  };
});

function Tags({ recipeId }: { recipeId?: string }) {
  const [tags, setTags] = useState<string[]>([]);

  return (
    <>
      <TagPicker recipeId={recipeId} value={tags} onChange={setTags} />
      <output data-testid="tags">{tags.join("|")}</output>
    </>
  );
}

beforeEach(() => {
  // jsdom has no scrolling; the open listbox scrolls its focused row into view.
  HTMLElement.prototype.scrollTo = () => {};
  mocks.entries = [
    { id: "1", name: "BBQ" },
    { id: "2", name: "Café" },
  ];
  mocks.created.mockClear();
  mocks.readFor.mockClear();
  mocks.offline = false;
});

describe("TagPicker", () => {
  it("picks an existing Tag typed in another case, and offers no Create row for it", async () => {
    const user = userEvent.setup();

    render(<Tags />);
    await user.type(screen.getByRole("combobox", { name: "addTag" }), "bbq");

    expect(screen.getByRole("option", { name: "BBQ" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^create/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "BBQ" }));

    expect(screen.getByTestId("tags")).toHaveTextContent("BBQ");
    expect(screen.getByRole("combobox", { name: "addTag" })).toHaveValue("");
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "addTag" })).toHaveAttribute(
        "aria-expanded",
        "false"
      )
    );
    expect(mocks.created).not.toHaveBeenCalled();
  });

  it("finds Café by cafe", async () => {
    const user = userEvent.setup();

    render(<Tags />);
    await user.type(screen.getByRole("combobox", { name: "addTag" }), "cafe");

    expect(screen.getByRole("option", { name: "Café" })).toBeInTheDocument();
  });

  it("creates a new Tag from its own option of the listbox, and selects it", async () => {
    const user = userEvent.setup();

    render(<Tags />);
    await user.type(screen.getByRole("combobox", { name: "addTag" }), "Grill");

    const create = screen.getByRole("option", { name: "create Grill" });

    expect(create).toBeInTheDocument();
    await user.click(create);

    expect(mocks.created).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("tags")).toHaveTextContent("Grill");
    expect(screen.getByRole("combobox", { name: "addTag" })).toHaveValue("");
  });

  it("creates with the keyboard: Enter on the focused Create row", async () => {
    const user = userEvent.setup();

    render(<Tags />);
    await user.type(screen.getByRole("combobox", { name: "addTag" }), "Grill");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(mocks.created).toHaveBeenCalledWith("Grill");
    expect(screen.getByTestId("tags")).toHaveTextContent("Grill");
  });

  it("creates nothing by typing, by Escape or by leaving the field", async () => {
    const user = userEvent.setup();

    render(<Tags />);
    await user.type(screen.getByRole("combobox", { name: "addTag" }), "Grill");
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "addTag" })).toHaveAttribute(
        "aria-expanded",
        "false"
      )
    );
    await user.tab();

    expect(mocks.created).not.toHaveBeenCalled();
    expect(screen.getByTestId("tags")).toHaveTextContent("");
  });

  it("offers no Create row for empty or whitespace-only text", async () => {
    const user = userEvent.setup();

    render(<Tags />);
    await user.type(screen.getByRole("combobox", { name: "addTag" }), "   ");

    expect(screen.queryByRole("option", { name: /^create/ })).not.toBeInTheDocument();
  });

  it("reads the list of the recipe being edited", () => {
    render(<Tags recipeId="55555555-5555-4555-8555-555555555555" />);

    expect(mocks.readFor).toHaveBeenCalledWith("tag", "55555555-5555-4555-8555-555555555555");
  });

  it("offers the Create row offline but disabled, with its own wording", async () => {
    mocks.offline = true;
    const user = userEvent.setup();

    render(<Tags />);
    await user.type(screen.getByRole("combobox", { name: "addTag" }), "Grill");

    const create = screen.getByRole("option", { name: "createOffline Grill" });

    expect(create).toHaveAttribute("aria-disabled", "true");
    await user.click(create);
    expect(mocks.created).not.toHaveBeenCalled();
  });
});

describe("Category picker", () => {
  function Categories() {
    const [picked, setPicked] = useState<string[]>([]);

    return (
      <>
        <EntryComboBox
          kind="category"
          label="addCategory"
          isSelected={(entry) => picked.includes(entry.name)}
          onSelect={(entry) => setPicked([...picked, entry.name])}
        />
        <output data-testid="picked">{picked.join("|")}</output>
      </>
    );
  }

  it("picks an existing Category by a different case, and creates a new one explicitly", async () => {
    mocks.entries = [{ id: "1", name: "Dinner" }];
    const user = userEvent.setup();

    render(<Categories />);
    await user.type(screen.getByRole("combobox", { name: "addCategory" }), "DINNER");
    await user.click(screen.getByRole("option", { name: "Dinner" }));
    expect(screen.getByTestId("picked")).toHaveTextContent("Dinner");

    await user.type(screen.getByRole("combobox", { name: "addCategory" }), "Brunch");
    await user.click(screen.getByRole("option", { name: "create Brunch" }));

    expect(mocks.created).toHaveBeenCalledWith("Brunch");
    expect(screen.getByTestId("picked")).toHaveTextContent("Dinner|Brunch");
  });

  it("does not offer a name over the bound, and says why", async () => {
    const user = userEvent.setup();

    render(<Categories />);
    await user.type(screen.getByRole("combobox", { name: "addCategory" }), "x".repeat(41));

    expect(screen.queryByRole("option", { name: /^create/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("tooLong 40").length).toBeGreaterThan(0));
  });
});

describe("Cuisine picker", () => {
  function Cuisines({ carried }: { carried?: { id: string; name: string }[] }) {
    const [provenance, setProvenance] = useState({
      ...EMPTY_PROVENANCE_FORM_VALUE,
      cuisineIds: carried?.map((c) => c.id) ?? [],
    });

    return (
      <>
        <ProvenanceFields
          carriedCuisines={carried}
          recipeId="55555555-5555-4555-8555-555555555555"
          value={provenance}
          onChange={setProvenance}
        />
        <output data-testid="ids">{provenance.cuisineIds.join("|")}</output>
      </>
    );
  }

  beforeEach(() => {
    mocks.entries = [{ id: "thai", name: "Thai" }];
  });

  it("picks an existing Cuisine typed in another case", async () => {
    const user = userEvent.setup();

    render(<Cuisines />);
    await user.type(screen.getAllByRole("combobox", { name: "cuisines" })[0]!, "THAI");
    await user.click(screen.getByRole("option", { name: "Thai" }));

    expect(screen.getByTestId("ids")).toHaveTextContent("thai");
    expect(mocks.created).not.toHaveBeenCalled();
    expect(mocks.readFor).toHaveBeenCalledWith("cuisine", "55555555-5555-4555-8555-555555555555");
  });

  it("creates a Cuisine from its Create row and selects what was made", async () => {
    const user = userEvent.setup();

    render(<Cuisines />);
    await user.type(screen.getByRole("combobox", { name: "cuisines" }), "Peruvian");
    await user.click(screen.getByRole("option", { name: "create Peruvian" }));

    expect(mocks.created).toHaveBeenCalledWith("Peruvian");
    expect(screen.getByTestId("ids")).toHaveTextContent("new-Peruvian");
  });

  it("names a carried Cuisine the list does not offer, never by its id", () => {
    render(<Cuisines carried={[{ id: "old-id", name: "Old household's" }]} />);

    expect(screen.getByRole("button", { name: "removeNamed Old household's" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /old-id/ })).not.toBeInTheDocument();
  });
});
