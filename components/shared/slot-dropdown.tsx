import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Slot } from "@/types";

type SlotDropdownProps = {
  children: ReactNode;
  onSelectSlot: (slot: Slot) => void;
  ariaLabel?: string;
};

export function SlotDropdown({ children, onSelectSlot, ariaLabel }: SlotDropdownProps) {
  const t = useTranslations("common.slots");

  return (
    <Dropdown>
      <DropdownTrigger>{children}</DropdownTrigger>
      <DropdownMenu
        aria-label={ariaLabel ?? t("chooseSlot")}
        onAction={(slot) => onSelectSlot(slot as Slot)}
      >
        <DropdownItem key="Breakfast">{t("breakfast")}</DropdownItem>
        <DropdownItem key="Lunch">{t("lunch")}</DropdownItem>
        <DropdownItem key="Dinner">{t("dinner")}</DropdownItem>
        <DropdownItem key="Snack">{t("snack")}</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
