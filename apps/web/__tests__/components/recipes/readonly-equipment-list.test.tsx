import type { ReactNode } from "react";
import { ReadonlyEquipmentList } from "@/components/recipes/readonly-equipment-list";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/equipment/equipment-icon", () => ({
  EquipmentIconsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  EquipmentIcon: ({ src, equipmentId }: { src?: string | null; equipmentId?: string | null }) =>
    src || equipmentId === "00000000-0000-4000-8000-000000000001" ? (
      <img alt="" data-testid="equipment-icon" src={src ?? "/equipment-icons/pan.webp"} />
    ) : null,
}));

vi.mock("@/components/shared/smart-markdown-renderer", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

describe("ReadonlyEquipmentList", () => {
  it("renders nothing when equipment array is empty", () => {
    const { container } = render(<ReadonlyEquipmentList equipment={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders equipment items sorted by order as a static list and omits icon slot when no icon exists", () => {
    const equipment = [
      {
        id: "eq-2",
        equipmentId: "00000000-0000-4000-8000-000000000002",
        name: "Chef's Knife",
        icon: null,
        order: 2,
      },
      {
        id: "eq-0",
        name: "# Baking",
        order: 0,
      },
      {
        id: "eq-1",
        equipmentId: "00000000-0000-4000-8000-000000000001",
        name: "Frying Pan",
        icon: "/equipment-icons/pan.webp",
        order: 1,
      },
    ];

    render(<ReadonlyEquipmentList equipment={equipment} />);

    const items = screen.getAllByRole("listitem");

    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Baking");
    expect(items[1]).toHaveTextContent("Frying Pan");
    expect(items[2]).toHaveTextContent("Chef's Knife");
    // Static list: no interactive buttons/checkboxes
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    // Only the item with an icon renders an img; items without an icon render no prefix element
    expect(screen.getAllByTestId("equipment-icon")).toHaveLength(1);
    expect(items[2]?.querySelector("[data-testid='equipment-icon']")).toBeNull();
  });
});
