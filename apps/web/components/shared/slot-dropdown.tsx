import { ReactNode } from "react";
import { Dropdown, Label } from "@heroui/react";
import { useTranslations } from "next-intl";

import { Slot } from "@norish/shared/contracts";

type SlotDropdownProps = {
  children: ReactNode;
  onSelectSlot: (slot: Slot) => void;
  ariaLabel?: string;
};
export function SlotDropdown({ children, onSelectSlot, ariaLabel }: SlotDropdownProps) {
  const t = useTranslations("common.slots");
  return (
    <Dropdown>
      {children}
      <Dropdown.Popover className="bg-overlay">
        <Dropdown.Menu
          aria-label={ariaLabel ?? t("chooseSlot")}
          onAction={(slot) => onSelectSlot(slot as Slot)}
        >
          <Dropdown.Item key="Breakfast" id="Breakfast" textValue="Breakfast">
            <Label>{t("breakfast")}</Label>
          </Dropdown.Item>
          <Dropdown.Item key="Lunch" id="Lunch" textValue="Lunch">
            <Label>{t("lunch")}</Label>
          </Dropdown.Item>
          <Dropdown.Item key="Dinner" id="Dinner" textValue="Dinner">
            <Label>{t("dinner")}</Label>
          </Dropdown.Item>
          <Dropdown.Item key="Snack" id="Snack" textValue="Snack">
            <Label>{t("snack")}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
