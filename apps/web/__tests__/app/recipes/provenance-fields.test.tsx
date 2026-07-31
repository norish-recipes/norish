import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { ProvenanceFormValue } from "@/app/(app)/recipes/edit/components/provenance-fields";
import ProvenanceFields from "@/app/(app)/recipes/edit/components/provenance-fields";

const mocks = vi.hoisted(() => ({
  cuisines: [
    { id: "id-italian", name: "Italian", version: 1 },
    { id: "id-japanese", name: "Japanese", version: 1 },
  ],
}));

vi.mock("@/hooks/config", () => ({
  useCuisinesQuery: () => ({ cuisines: mocks.cuisines, isLoading: false }),
}));

/**
 * The pickers are stubbed down to their contract — the set of rows they offer
 * and the selection they report — because what matters here is which value the
 * form produces, not how HeroUI renders a popover.
 */
vi.mock("@heroui/react", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

  // Mirrors React Aria's real multiple-selection contract: an ordered `value`
  // array with `onChange`, NOT `selectedKeys`/`onSelectionChange` — those are
  // the deprecated single-selection props, which a multiple-mode Select
  // silently ignores. Stubbing the wrong pair here is exactly what let a
  // permanently-empty control pass its tests.
  type ChangeHandler = (keys: string[]) => void;

  const selectionContext: {
    combo?: (key: string | null) => void;
    select?: ChangeHandler;
  } = {};

  const ComboBoxRoot = ({
    children,
    selectedKey,
    onSelectionChange,
  }: {
    children?: React.ReactNode;
    selectedKey?: string | null;
    onSelectionChange?: (key: string | null) => void;
  }) => {
    selectionContext.combo = onSelectionChange;

    return (
      <div data-selected-country={selectedKey ?? ""}>
        {children}
        {/* React Aria reports a null key when the popover closes with no choice. */}
        <button onClick={() => onSelectionChange?.(null)}>dismiss-country</button>
      </div>
    );
  };

  const SelectRoot = ({
    children,
    value,
    onChange,
  }: {
    children?: React.ReactNode;
    value?: readonly string[];
    onChange?: ChangeHandler;
  }) => {
    selectionContext.select = onChange;

    return (
      <div data-selected-cuisines={(value ?? []).join(",")}>
        {children}
        {/* Stands in for opening the popover and clicking a row. */}
        {mocks.cuisines.map((cuisine) => (
          <button
            key={cuisine.id}
            onClick={() => {
              const current = value ?? [];

              onChange?.(
                current.includes(cuisine.id)
                  ? current.filter((id) => id !== cuisine.id)
                  : [...current, cuisine.id]
              );
            }}
          >
            toggle:{cuisine.name}
          </button>
        ))}
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
    Select: Object.assign(SelectRoot, {
      Trigger: Passthrough,
      Value: ({
        children,
      }: {
        children?: (renderProps: {
          defaultChildren: React.ReactNode;
          isPlaceholder: boolean;
        }) => React.ReactNode;
      }) => <div>{children?.({ defaultChildren: null, isPlaceholder: false })}</div>,
      Indicator: () => null,
      Popover: Passthrough,
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
  useTranslations: () => (key: string) => key,
}));

const FILLED: ProvenanceFormValue = {
  originCountry: "IT",
  originRegion: "Lazio",
  provenanceNote: "Una classica ricetta romana.",
  cuisineIds: ["id-italian"],
};

let onChange: (value: ProvenanceFormValue) => void;

beforeEach(() => {
  onChange = vi.fn<(value: ProvenanceFormValue) => void>();
});

describe("Recipe Provenance form fields", () => {
  it("offers the vocabulary rather than free text", () => {
    const { container } = render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    // An editor's manual entries have to match the ones AI produces.
    expect(container.querySelector('[data-row="id-italian"]')).toHaveTextContent("Italian");
    expect(container.querySelector('[data-row="id-japanese"]')).toHaveTextContent("Japanese");
  });

  it("names the selected Cuisines on the closed control", () => {
    const { container } = render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    // The trigger has to say what is chosen; the rows are behind a popover.
    expect(container.querySelector("[data-selected-cuisines]")).toHaveTextContent("Italian");
  });

  it("hands the recipe's current Cuisines to the multiselect", () => {
    const { container } = render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    expect(container.querySelector("[data-selected-cuisines]")).toHaveAttribute(
      "data-selected-cuisines",
      "id-italian"
    );
  });

  it("adds a Cuisine without disturbing the rest of the group", () => {
    render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.click(screen.getByText("toggle:Japanese"));

    expect(onChange).toHaveBeenCalledWith({
      ...FILLED,
      cuisineIds: ["id-italian", "id-japanese"],
    });
  });

  it("removes a Cuisine that is already selected", () => {
    render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.click(screen.getByText("toggle:Italian"));

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

  it("clears the country on its own, leaving the rest of the group alone", () => {
    const { container } = render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.click(container.querySelector('[data-row="__none__"]')!);

    expect(onChange).toHaveBeenCalledWith({ ...FILLED, originCountry: null });
  });

  it("treats a dismissed picker as leaving the country unset", () => {
    render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.click(screen.getByText("dismiss-country"));

    expect(onChange).toHaveBeenCalledWith({ ...FILLED, originCountry: null });
  });

  it("still records a country the editor picks", () => {
    const { container } = render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.click(container.querySelector('[data-row="JP"]')!);

    expect(onChange).toHaveBeenCalledWith({ ...FILLED, originCountry: "JP" });
  });
});
