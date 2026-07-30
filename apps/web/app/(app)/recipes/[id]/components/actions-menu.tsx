"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { MiniCalendar, MiniGroceries } from "@/components/Panel/consumers";
import { DeleteRecipeModal } from "@/components/shared/delete-recipe-modal";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipesContext } from "@/context/recipes-context";
import { useActiveAllergies } from "@/hooks/user";
import {
  CalendarDaysIcon,
  DevicePhoneMobileIcon,
  EllipsisHorizontalIcon,
  PencilSquareIcon,
  ShareIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { Button, Dropdown, Label, useOverlayState } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { RecipeEnrichmentKind } from "@norish/shared/lib/recipe-enrichment";
import { cssAIGradientText, cssAIIconColor, cssButtonPill } from "@norish/web/config/css-tokens";

import { useRecipeContextRequired } from "../context";
import RecipeSharePanel from "./recipe-share-panel";
import { useWakeLockContext } from "./wake-lock-context";

type Props = {
  id: string;
};
type MenuItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  className?: string;
  labelClassName?: string;
  iconClassName?: string;
  isDisabled?: boolean;
  /** Secondary line under the label, e.g. a quiet enrichment failure. */
  description?: string;
  descriptionClassName?: string;
};
export default function ActionsMenu({ id }: Props) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [openCalendar, setOpenCalendar] = React.useState(false);
  const [openGroceries, setOpenGroceries] = React.useState(false);
  const [openSharePanel, setOpenSharePanel] = React.useState(false);
  const {
    isOpen: isDeleteModalOpen,
    open: onDeleteModalOpen,
    close: onDeleteModalClose,
  } = useOverlayState();
  const router = useRouter();
  const { canEditRecipe, canDeleteRecipe, isAIEnabled } = usePermissionsContext();
  const { deleteRecipe } = useRecipesContext();
  const { recipe, enrichment } = useRecipeContextRequired();
  const { allergies } = useActiveAllergies();
  const { isSupported, isActive, toggle } = useWakeLockContext();
  const t = useTranslations("recipes.actions");
  const tEnrichment = useTranslations("recipes.enrichment");
  const canEdit = recipe.userId ? canEditRecipe(recipe.userId) : true;
  const canDelete = recipe.userId ? canDeleteRecipe(recipe.userId) : true;
  const handleDeleteClick = React.useCallback(() => {
    onDeleteModalOpen();
  }, [onDeleteModalOpen]);
  const handleDeleteConfirm = React.useCallback(() => {
    onDeleteModalClose();
    deleteRecipe(id, recipe.version);
    router.push("/");
  }, [deleteRecipe, id, recipe.version, router, onDeleteModalClose]);
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
        key: "share",
        label: t("share"),
        icon: <ShareIcon className="size-4" />,
        onPress: () => setOpenSharePanel(true),
      });
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
        iconClassName: isActive ? "text-success" : "text-muted",
      });
    }
    // Manual Recipe Enrichment: shown on AI enablement and edit permission alone.
    // The administrator's automatic switches decide what runs on creation, not
    // whether an editor may ask for it.
    if (isAIEnabled && canEdit) {
      // Every kind renders the same way, so the states read consistently
      // and a quiet automatic failure is still discoverable here.
      const enrichmentActions: {
        kind: RecipeEnrichmentKind;
        key: string;
        idleLabel: string;
        busyLabel: string;
        show?: boolean;
      }[] = [
        {
          kind: "auto-tagging",
          key: "auto-tag",
          idleLabel: t("autoTag"),
          busyLabel: t("autoTagging"),
        },
        {
          kind: "auto-categorization",
          key: "auto-categorize",
          idleLabel: t("autoCategorize"),
          busyLabel: t("autoCategorizing"),
        },
        {
          kind: "allergy-detection",
          key: "detect-allergies",
          idleLabel: t("detectAllergies"),
          busyLabel: t("detectingAllergies"),
          // Allergy detection needs something to look for.
          show: allergies.length > 0,
        },
        {
          kind: "nutrition-estimation",
          key: "estimate-nutrition",
          idleLabel: t("estimateNutrition"),
          busyLabel: t("estimatingNutrition"),
        },
        {
          kind: "recipe-provenance",
          key: "infer-provenance",
          idleLabel: t("inferProvenance"),
          busyLabel: t("inferringProvenance"),
        },
      ];

      for (const action of enrichmentActions) {
        if (action.show === false) continue;

        const state = enrichment.states[action.kind];
        const isBusy = state === "queued" || state === "processing";

        items.push({
          key: action.key,
          label: isBusy ? action.busyLabel : action.idleLabel,
          icon: <SparklesIcon className="size-4" />,
          onPress: () => enrichment.request(action.kind),
          labelClassName: cssAIGradientText,
          iconClassName: cssAIIconColor,
          // A failed run stays visible and re-runnable; only an in-flight one
          // is disabled.
          description: state === "idle" ? undefined : tEnrichment(`states.${state}`),
          descriptionClassName: state === "failed" ? "text-danger" : "text-muted",
          isDisabled: isBusy,
        });
      }
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
    tEnrichment,
    isAIEnabled,
    allergies,
    enrichment,
  ]);
  return (
    <>
      <Dropdown isOpen={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <Button
          isIconOnly
          aria-label={t("actionsLabel")}
          className="transition active:scale-95"
          size="sm"
          variant="tertiary"
        >
          <EllipsisHorizontalIcon className="text-muted h-5 w-5" />
        </Button>

        <Dropdown.Popover className="bg-overlay z-[500]">
          <Dropdown.Menu
            aria-label={t("actionsLabel")}
            className="scrollbar-hide max-h-[min(24rem,calc(100vh-6rem))] overflow-y-auto"
            items={menuItems}
          >
            {(item: MenuItem) => (
              <Dropdown.Item
                id={item.key}
                key={item.key}
                className="py-1 data-[focus=true]:bg-transparent data-[hovered=true]:bg-transparent"
                textValue={item.label}
              >
                <Button
                  className={`w-full justify-start bg-transparent ${cssButtonPill} ${item.className ?? ""}`}
                  isDisabled={item.isDisabled}
                  size="md"
                  onPress={() => {
                    setIsDropdownOpen(false);
                    item.onPress();
                  }}
                  variant="tertiary"
                >
                  {<span className={item.iconClassName ?? "text-muted"}>{item.icon}</span>}
                  <span className="flex flex-col items-start">
                    <span className={`text-sm font-medium ${item.labelClassName ?? ""}`}>
                      <Label>{item.label}</Label>
                    </span>
                    {item.description && (
                      <span className={`${item.descriptionClassName ?? "text-muted"} text-xs`}>
                        {item.description}
                      </span>
                    )}
                  </span>
                </Button>
              </Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <MiniGroceries open={openGroceries} recipeId={id} onOpenChange={setOpenGroceries} />

      <MiniCalendar open={openCalendar} recipeId={id} onOpenChange={setOpenCalendar} />

      <RecipeSharePanel open={openSharePanel} onOpenChange={setOpenSharePanel} />

      <DeleteRecipeModal
        isOpen={isDeleteModalOpen}
        recipeName={recipe.name}
        onClose={onDeleteModalClose}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
