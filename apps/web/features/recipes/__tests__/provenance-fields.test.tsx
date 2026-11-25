import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { ProvenanceFormValue } from "@/features/recipes/components/editor/provenance-fields";
import ProvenanceFields from "@/features/recipes/components/editor/provenance-fields";

const mocks = vi.hoisted(() => ({
  cuisines: [
    { id: "id-italian", name: "Italian", version: 1 },
    { id: "id-japanese", name: "Japanese", version: 1 },
  ],
}));

vi.mock("@norish/shared-react/lists", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/lists")>()),
  useListEntries: () => ({ entries: mocks.cuisines, isLoading: false }),
}));

/** The picker's own behaviour is tested with it; here it stands for picking a row of the list. */
vi.mock("@/components/shared/entry-combo-box", () => ({
  EntryComboBox: ({
    isSelected,
    onSelect,
  }: {
    isSelected: (entry: { id: string; name: string }) => boolean;
    onSelect: (entry: { id: string; name: string }) => void;
  }) => (
    <div>
      {mocks.cuisines
        .filter((cuisine) => !isSelected(cuisine))
        .map((cuisine) => (
          <button key={cuisine.id} data-row={cuisine.id} onClick={() => onSelect(cuisine)}>
            pick:{cuisine.name}
          </button>
        ))}
    </div>
  ),
}));

vi.mock("@/components/shared/chip-button", () => ({
  ChipButton: ({
    children,
    onClick,
    "aria-label": label,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    "aria-label"?: string;
  }) => (
    <button aria-label={label} onClick={onClick}>
      {children}
    </button>
  ),
}));

/**
 * The pickers are stubbed down to their contract — the set of rows they offer
 * and the selection they report — because what matters here is which value the
 * form produces, not how HeroUI renders a popover.
 */
vi.mock("@heroui/react", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

  // Mirrors React Aria's real selection contract: `value` with `onChange`, NOT
  // `selectedKey(s)`/`onSelectionChange` — those are the deprecated
  // single-selection props, which a multiple-mode Select silently ignores.
  // Stubbing the wrong pair here is exactly what let a permanently-empty
  // control pass its tests.
  const selectionContext: { combo?: (key: string | null) => void } = {};

  const ComboBoxRoot = ({
    children,
    value,
    onChange,
  }: {
    children?: React.ReactNode;
    value?: string | null;
    onChange?: (key: string | null) => void;
  }) => {
    selectionContext.combo = onChange;

    return (
      <div data-selected-country={value ?? ""}>
        {children}
        {/* React Aria reports a null key when the popover closes with no choice. */}
        <button onClick={() => onChange?.(null)}>dismiss-country</button>
      </div>
    );
  };

  return {
    ComboBox: Object.assign(ComboBoxRoot, {
      InputGroup: Passthrough,
      Trigger: () => null,
      Popover: Passthrough,
    }),
    Input: () => <input />,
    Label: ({ children }: { children?: React.ReactNode }) => <label>{children}</label>,
    ListBox: Object.assign(Passthrough, {
      Item: ({ children, id }: { children?: React.ReactNode; id?: string }) => (
        <div
          data-row={id}
          onClick={() => {
            if (selectionContext.combo) selectionContext.combo(id ?? null);
          }}
        >
          {children}
        </div>
      ),
      ItemIndicator: () => null,
    }),
    TextArea: () => <textarea />,
    TextField: ({
      children,
      value,
      onChange,
      "aria-label": ariaLabel,
    }: {
      children?: React.ReactNode;
      value?: string;
      onChange?: (value: string) => void;
      "aria-label"?: string;
    }) => (
      <div>
        {children}
        <input
          aria-label={ariaLabel}
          value={value ?? ""}
          onChange={(event) => onChange?.(event.target.value)}
        />
      </div>
    ),
  };
});

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(" ")}` : key,
}));

const FILLED: ProvenanceFormValue = {
  originCountry: "IT",
  originCountryName: "Italia",
  originRegion: "Lazio",
  provenanceNote: "Una classica ricetta romana.",
  cuisineIds: ["id-italian"],
};

let onChange: (value: ProvenanceFormValue) => void;

beforeEach(() => {
  onChange = vi.fn<(value: ProvenanceFormValue) => void>();
});

describe("Recipe Provenance form fields", () => {
  it("offers the list's Cuisines not yet chosen", () => {
    const { container } = render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    expect(container.querySelector('[data-row="id-japanese"]')).toHaveTextContent("Japanese");
    expect(container.querySelector('[data-row="id-italian"]')).not.toBeInTheDocument();
  });

  it("names the chosen Cuisines as chips", () => {
    render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    expect(screen.getByRole("button", { name: "removeNamed Italian" })).toHaveTextContent(
      "Italian"
    );
  });

  it("names a Cuisine the recipe carries and the list does not offer", () => {
    render(
      <ProvenanceFields
        carriedCuisines={[{ id: "id-old", name: "Old" }]}
        value={{ ...FILLED, cuisineIds: ["id-old"] }}
        onChange={onChange}
      />
    );

    expect(screen.getByRole("button", { name: "removeNamed Old" })).toBeInTheDocument();
  });

  it("adds a Cuisine without disturbing the rest of the group", () => {
    render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.click(screen.getByText("pick:Japanese"));

    expect(onChange).toHaveBeenCalledWith({
      ...FILLED,
      cuisineIds: ["id-italian", "id-japanese"],
    });
  });

  it("removes a Cuisine that is already selected", () => {
    render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "removeNamed Italian" }));

    expect(onChange).toHaveBeenCalledWith({ ...FILLED, cuisineIds: [] });
  });

  it("edits the region without disturbing the rest of the group", () => {
    render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("originRegion"), { target: { value: "Sicily" } });

    expect(onChange).toHaveBeenCalledWith({ ...FILLED, originRegion: "Sicily" });
  });

  it("offers a row for picking no country at all", () => {
    const { container } = render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    // Without it a country could be changed but never taken back.
    expect(container.querySelector('[data-row="__none__"]')).toBeInTheDocument();
  });

  it("clears the country on its own, taking its written name with it", () => {
    const { container } = render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.click(container.querySelector('[data-row="__none__"]')!);

    expect(onChange).toHaveBeenCalledWith({
      ...FILLED,
      originCountry: null,
      originCountryName: null,
    });
  });

  it("treats a dismissed picker as leaving the country unset", () => {
    render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.click(screen.getByText("dismiss-country"));

    expect(onChange).toHaveBeenCalledWith({
      ...FILLED,
      originCountry: null,
      originCountryName: null,
    });
  });

  it("records a picked country as the label the editor saw, in their own words", () => {
    const { container } = render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.click(container.querySelector('[data-row="JP"]')!);

    // The picker runs in the editor's locale (English here), so the stored
    // written name is the row they clicked, not an endonym or a translation.
    expect(onChange).toHaveBeenCalledWith({
      ...FILLED,
      originCountry: "JP",
      originCountryName: "Japan",
    });
  });
});
