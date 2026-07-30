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

vi.mock("@heroui/react", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

  return {
    Button: ({
      children,
      onPress,
      isDisabled,
      variant,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      isDisabled?: boolean;
      variant?: string;
    }) => (
      <button data-variant={variant} disabled={isDisabled} onClick={onPress}>
        {children}
      </button>
    ),
    ComboBox: Object.assign(Passthrough, {
      InputGroup: Passthrough,
      Trigger: () => null,
      Popover: Passthrough,
    }),
    Input: () => <input />,
    Label: ({ children }: { children?: React.ReactNode }) => <label>{children}</label>,
    ListBox: Object.assign(Passthrough, {
      Item: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
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
    render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    // An editor's manual entries have to match the ones AI produces.
    expect(screen.getByText("Italian")).toBeInTheDocument();
    expect(screen.getByText("Japanese")).toBeInTheDocument();
  });

  it("marks the recipe's current Cuisines as selected", () => {
    render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    expect(screen.getByText("Italian").closest("button")).toHaveAttribute(
      "data-variant",
      "primary"
    );
    expect(screen.getByText("Japanese").closest("button")).toHaveAttribute(
      "data-variant",
      "tertiary"
    );
  });

  it("adds a Cuisine without disturbing the rest of the group", () => {
    render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.click(screen.getByText("Japanese"));

    expect(onChange).toHaveBeenCalledWith({
      ...FILLED,
      cuisineIds: ["id-italian", "id-japanese"],
    });
  });

  it("removes a Cuisine that is already selected", () => {
    render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.click(screen.getByText("Italian"));

    expect(onChange).toHaveBeenCalledWith({ ...FILLED, cuisineIds: [] });
  });

  it("edits the region without disturbing the rest of the group", () => {
    render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("originRegion"), { target: { value: "Sicily" } });

    expect(onChange).toHaveBeenCalledWith({ ...FILLED, originRegion: "Sicily" });
  });

  it("clears the whole group as one action", () => {
    render(<ProvenanceFields value={FILLED} onChange={onChange} />);

    fireEvent.click(screen.getByText("clearProvenance"));

    // Atomic: the note explains the whole claim, so it goes with the rest.
    expect(onChange).toHaveBeenCalledWith({
      originCountry: null,
      originRegion: "",
      provenanceNote: "",
      cuisineIds: [],
    });
  });

  it("offers nothing to clear when the group is already empty", () => {
    render(
      <ProvenanceFields
        value={{ originCountry: null, originRegion: "", provenanceNote: "", cuisineIds: [] }}
        onChange={onChange}
      />
    );

    expect(screen.getByText("clearProvenance").closest("button")).toBeDisabled();
  });
});
