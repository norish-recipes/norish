"use client";
import React, { useMemo } from "react";
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import {
  CalendarDaysIcon,
  ShoppingCartIcon,
  PencilSquareIcon,
  TrashIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/20/solid";
import { EllipsisHorizontalIcon } from "@heroicons/react/16/solid";
import { useRouter } from "next/navigation";

import { useRecipeContextRequired } from "../context";

import { useWakeLockContext } from "./wake-lock-context";

import { cssButtonPill } from "@/config/css-tokens";
import { MiniGroceries, MiniCalendar } from "@/components/Panel/consumers";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipesContext } from "@/context/recipes-context";

type Props = { id: string };

type MenuItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  className?: string;
  iconClassName?: string;
};

export default function ActionsMenu({ id }: Props) {
  const [openCalendar, setOpenCalendar] = React.useState(false);
  const [openGroceries, setOpenGroceries] = React.useState(false);
  const router = useRouter();
  const { canEditRecipe, canDeleteRecipe } = usePermissionsContext();
  const { deleteRecipe } = useRecipesContext();
  const { recipe } = useRecipeContextRequired();
  const { isSupported, isActive, toggle } = useWakeLockContext();

  const canEdit = recipe.userId ? canEditRecipe(recipe.userId) : true;
  const canDelete = recipe.userId ? canDeleteRecipe(recipe.userId) : true;

  const handleDelete = React.useCallback(() => {
    deleteRecipe(id);
    router.push("/");
  }, [deleteRecipe, id, router]);

  const menuItems = useMemo(() => {
    const items: MenuItem[] = [
      {
        key: "plan",
        label: "Plan",
        icon: <CalendarDaysIcon className="size-4" />,
        onPress: () => setOpenCalendar(true),
      },
      {
        key: "groceries",
        label: "Groceries",
        icon: <ShoppingCartIcon className="size-4" />,
        onPress: () => setOpenGroceries(true),
      },
    ];

    if (canEdit) {
      items.push({
        key: "edit",
        label: "Edit",
        icon: <PencilSquareIcon className="size-4" />,
        onPress: () => router.push(`/recipes/edit/${id}`),
      });
    }

    if (isSupported) {
      items.push({
        key: "wake-lock",
        label: isActive ? "Screen On" : "Keep Screen On",
        icon: <DevicePhoneMobileIcon className="size-4" />,
        onPress: toggle,
        className: isActive ? "text-success" : "",
        iconClassName: isActive ? "text-success" : "text-default-400",
      });
    }

    if (canDelete) {
      items.push({
        key: "delete",
        label: "Delete",
        icon: <TrashIcon className="size-4" />,
        onPress: handleDelete,
        className: "text-danger",
        iconClassName: "text-danger",
      });
    }

    return items;
  }, [canEdit, canDelete, handleDelete, id, router, isSupported, isActive, toggle]);

  return (
    <>
      <Dropdown>
        <DropdownTrigger>
          <Button
            isIconOnly
            aria-label="Actions"
            className="transition active:scale-95"
            size="sm"
            variant="light"
          >
            <EllipsisHorizontalIcon className="text-default-500 h-5 w-5" />
          </Button>
        </DropdownTrigger>

        <DropdownMenu aria-label="Recipe actions" items={menuItems}>
          {(item) => (
            <DropdownItem
              key={item.key}
              className="py-1 data-[focus=true]:bg-transparent data-[hover=true]:bg-transparent"
            >
              <Button
                className={`w-full justify-start bg-transparent ${cssButtonPill} ${item.className ?? ""}`}
                radius="full"
                size="md"
                startContent={
                  <span className={item.iconClassName ?? "text-default-400"}>{item.icon}</span>
                }
                variant="light"
                onPress={item.onPress}
              >
                <span className="text-sm font-medium">{item.label}</span>
              </Button>
            </DropdownItem>
          )}
        </DropdownMenu>
      </Dropdown>

      <MiniGroceries open={openGroceries} recipeId={id} onOpenChange={setOpenGroceries} />

      <MiniCalendar open={openCalendar} recipeId={id} onOpenChange={setOpenCalendar} />
    </>
  );
}
