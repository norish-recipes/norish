"use client";
import React, { useMemo } from "react";
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  useDisclosure,
} from "@heroui/react";
import {
  EllipsisHorizontalIcon,
  CalendarDaysIcon,
  ShoppingCartIcon,
  PencilSquareIcon,
  TrashIcon,
  DevicePhoneMobileIcon,
  SparklesIcon,
} from "@heroicons/react/16/solid";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useRecipeContextRequired } from "../context";

import { useWakeLockContext } from "./wake-lock-context";

import { DeleteRecipeModal } from "@/components/shared/delete-recipe-modal";
import { cssButtonPill, cssAIGradientText, cssAIIconColor } from "@/config/css-tokens";
import { MiniGroceries, MiniCalendar } from "@/components/Panel/consumers";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipesContext } from "@/context/recipes-context";
import { useActiveAllergies } from "@/hooks/user";

type Props = { id: string };

type MenuItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  className?: string;
  labelClassName?: string;
  iconClassName?: string;
  isDisabled?: boolean;
};

export default function ActionsMenu({ id }: Props) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [openCalendar, setOpenCalendar] = React.useState(false);
  const [openGroceries, setOpenGroceries] = React.useState(false);
  const {
    isOpen: isDeleteModalOpen,
    onOpen: onDeleteModalOpen,
    onClose: onDeleteModalClose,
  } = useDisclosure();
  const router = useRouter();
  const { canEditRecipe, canDeleteRecipe, isAutoTaggingEnabled, isAIEnabled } =
    usePermissionsContext();
  const { deleteRecipe } = useRecipesContext();
  const {
    recipe,
    isAutoTagging,
    triggerAutoTag,
    isCategorizing,
    triggerAutoCategorize,
    isDetectingAllergies,
    triggerAllergyDetection,
    isEstimatingNutrition,
    estimateNutrition,
  } = useRecipeContextRequired();
  const { allergies } = useActiveAllergies();
  const { isSupported, isActive, toggle } = useWakeLockContext();
  const t = useTranslations("recipes.actions");

  const canEdit = recipe.userId ? canEditRecipe(recipe.userId) : true;
  const canDelete = recipe.userId ? canDeleteRecipe(recipe.userId) : true;

  const handleDeleteClick = React.useCallback(() => {
    onDeleteModalOpen();
  }, [onDeleteModalOpen]);

  const handleDeleteConfirm = React.useCallback(() => {
    onDeleteModalClose();
    deleteRecipe(id);
    router.push("/");
  }, [deleteRecipe, id, router, onDeleteModalClose]);

  const menuItems = useMemo(() => {
    const items: MenuItem[] = [
      {
        key: "plan",
        label: t("plan"),
        icon: <CalendarDaysIcon className="size-4" />,
        onPress: () => setOpenCalendar(true),
      },
      {
        key: "groceries",
        label: t("groceries"),
        icon: <ShoppingCartIcon className="size-4" />,
        onPress: () => setOpenGroceries(true),
      },
    ];

    if (canEdit) {
      items.push({
        key: "edit",
        label: t("edit"),
        icon: <PencilSquareIcon className="size-4" />,
        onPress: () => router.push(`/recipes/edit/${id}`),
      });
    }

    if (isSupported) {
      items.push({
        key: "wake-lock",
        label: isActive ? t("screenOn") : t("keepScreenOn"),
        icon: <DevicePhoneMobileIcon className="size-4" />,
        onPress: toggle,
        labelClassName: isActive ? "text-success" : "",
        iconClassName: isActive ? "text-success" : "text-default-400",
      });
    }

    if (isAutoTaggingEnabled && canEdit) {
      items.push({
        key: "auto-tag",
        label: isAutoTagging ? t("autoTagging") : t("autoTag"),
        icon: <SparklesIcon className="size-4" />,
        onPress: triggerAutoTag,
        labelClassName: cssAIGradientText,
        iconClassName: cssAIIconColor,
        isDisabled: isAutoTagging,
      });
    }

    if (isAIEnabled && canEdit) {
      items.push({
        key: "auto-categorize",
        label: t("autoCategorize"),
        icon: <SparklesIcon className="size-4" />,
        onPress: () => triggerAutoCategorize(),
        labelClassName: cssAIGradientText,
        iconClassName: cssAIIconColor,
        isDisabled: isCategorizing,
      });
    }

    // Show allergy detection when AI is enabled, user can edit, and allergies are configured
    const hasAllergies = allergies.length > 0;

    if (isAIEnabled && canEdit && hasAllergies) {
      items.push({
        key: "detect-allergies",
        label: isDetectingAllergies ? t("detectingAllergies") : t("detectAllergies"),
        icon: <SparklesIcon className="size-4" />,
        onPress: triggerAllergyDetection,
        labelClassName: cssAIGradientText,
        iconClassName: cssAIIconColor,
        isDisabled: isDetectingAllergies,
      });
    }

    // Show nutrition estimation when AI is enabled and user can edit
    if (isAIEnabled && canEdit) {
      items.push({
        key: "estimate-nutrition",
        label: isEstimatingNutrition ? t("estimatingNutrition") : t("estimateNutrition"),
        icon: <SparklesIcon className="size-4" />,
        onPress: estimateNutrition,
        labelClassName: cssAIGradientText,
        iconClassName: cssAIIconColor,
        isDisabled: isEstimatingNutrition,
      });
    }

    if (canDelete) {
      items.push({
        key: "delete",
        label: t("delete"),
        icon: <TrashIcon className="size-4" />,
        onPress: handleDeleteClick,
        labelClassName: "text-danger",
        iconClassName: "text-danger",
      });
    }

    return items;
  }, [
    canEdit,
    canDelete,
    handleDeleteClick,
    id,
    router,
    isSupported,
    isActive,
    toggle,
    t,
    isAutoTaggingEnabled,
    isAutoTagging,
    triggerAutoTag,
    isAIEnabled,
    allergies,
    isDetectingAllergies,
    triggerAllergyDetection,
    isEstimatingNutrition,
    estimateNutrition,
    isCategorizing,
    triggerAutoCategorize,
  ]);

  return (
    <>
      <Dropdown
        classNames={{ content: "z-[500]" }}
        isOpen={isDropdownOpen}
        onOpenChange={setIsDropdownOpen}
      >
        <DropdownTrigger>
          <Button
            isIconOnly
            aria-label={t("actionsLabel")}
            className="transition active:scale-95"
            size="sm"
            variant="light"
          >
            <EllipsisHorizontalIcon className="text-default-500 h-5 w-5" />
          </Button>
        </DropdownTrigger>

        <DropdownMenu aria-label={t("actionsLabel")} items={menuItems}>
          {(item) => (
            <DropdownItem
              key={item.key}
              className="py-1 data-[focus=true]:bg-transparent data-[hover=true]:bg-transparent"
            >
              <Button
                className={`w-full justify-start bg-transparent ${cssButtonPill} ${item.className ?? ""}`}
                isDisabled={item.isDisabled}
                radius="full"
                size="md"
                startContent={
                  <span className={item.iconClassName ?? "text-default-400"}>{item.icon}</span>
                }
                variant="light"
                onPress={() => {
                  setIsDropdownOpen(false);
                  item.onPress();
                }}
              >
                <span className={`text-sm font-medium ${item.labelClassName ?? ""}`}>
                  {item.label}
                </span>
              </Button>
            </DropdownItem>
          )}
        </DropdownMenu>
      </Dropdown>

      <MiniGroceries open={openGroceries} recipeId={id} onOpenChange={setOpenGroceries} />

      <MiniCalendar open={openCalendar} recipeId={id} onOpenChange={setOpenCalendar} />

      <DeleteRecipeModal
        isOpen={isDeleteModalOpen}
        recipeName={recipe.name}
        onClose={onDeleteModalClose}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
