"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CookbookIconSolid } from "@/components/cookbooks/cookbook-icon";
import MiniCalendar from "@/components/Panel/consumers/mini-calendar";
import MiniCookbooks from "@/components/Panel/consumers/mini-cookbooks";
import MiniGroceries from "@/components/Panel/consumers/mini-groceries";
import { DeleteRecipeModal } from "@/components/shared/delete-recipe-modal";
import { useRecipeEnrichment } from "@/features/recipes/hooks/use-recipe-enrichment";
import { useRecipesMutations } from "@/hooks/use-recipes-mutations";
import {
  CalendarDaysIcon,
  DevicePhoneMobileIcon,
  EllipsisHorizontalIcon,
  PencilSquareIcon,
  PrinterIcon,
  ShareIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { Button, Dropdown, Label, useOverlayState } from "@heroui/react";
import { useTranslations } from "next-intl";
import { twMerge } from "tailwind-merge";

import type { RecipeEnrichmentKind } from "@norish/shared/lib/recipe-enrichment";
import {
  ownerAllows,
  useActiveAllergies,
  usePermissions,
  useRecipePermissions,
} from "@norish/shared-react/reader";
import { useLoadedPageRecipe } from "@norish/shared-react/recipes";
import {
  cssAIGradientText,
  cssAIIconColor,
  cssButtonPill,
  cssButtonPillDanger,
} from "@norish/web/config/css-tokens";

import { usePageWakeLock } from "./page-wake-lock";
import RecipeSharePanel from "./recipe-share-panel";

type Props = {
  id: string;
  onPrint: () => void;
  /** Lets a caller draw the trigger as chrome floating on the recipe photo. */
  buttonClassName?: string;
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
export default function ActionsMenu({ id, buttonClassName, onPrint }: Props) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [openCalendar, setOpenCalendar] = React.useState(false);
  const [openGroceries, setOpenGroceries] = React.useState(false);
  const [openCookbooks, setOpenCookbooks] = React.useState(false);
  const [openSharePanel, setOpenSharePanel] = React.useState(false);

  const {
    isOpen: isDeleteModalOpen,
    open: onDeleteModalOpen,
    close: onDeleteModalClose,
  } = useOverlayState();
  const router = useRouter();

  const { canEditRecipe, canDeleteRecipe } = useRecipePermissions();
  const isAIEnabled = usePermissions((p) => p.isAIEnabled);
  const { deleteRecipes } = useRecipesMutations();
  const recipe = useLoadedPageRecipe();
  const enrichment = useRecipeEnrichment(id);

  const { allergies } = useActiveAllergies();
  const { isSupported, isActive, toggle } = usePageWakeLock();

  const t = useTranslations("recipes.actions");
  const tPrint = useTranslations("recipes.print");
  const tEnrichment = useTranslations("recipes.enrichment");
  const canEdit = ownerAllows(recipe.userId, canEditRecipe);
  const canDelete = ownerAllows(recipe.userId, canDeleteRecipe);

  const handleDeleteClick = React.useCallback(() => {
    onDeleteModalOpen();
  }, [onDeleteModalOpen]);

  const handleDeleteConfirm = React.useCallback(() => {
    onDeleteModalClose();
    deleteRecipes([{ id, version: recipe.version }]);
    router.push("/");
  }, [deleteRecipes, id, recipe.version, router, onDeleteModalClose]);

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
      {
        // Filing needs only view on the recipe and edit on the cookbook, so
        // this is offered to every reader who can see the page (ADR-0027).
        key: "cookbooks",
        label: t("cookbooks"),
        icon: <CookbookIconSolid className="size-4" />,
        onPress: () => setOpenCookbooks(true),
      },
    ];
    if (canEdit) {
      items.push({
        key: "share",
        label: t("share"),
        icon: <ShareIcon className="size-4" />,
        onPress: () => setOpenSharePanel(true),
      });
    }
    items.push({
      key: "print",
      label: tPrint("title"),
      icon: <PrinterIcon className="size-4" />,
      onPress: onPrint,
    });
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
        {
          kind: "ingredient-linking",
          key: "link-ingredients",
          idleLabel: t("linkIngredients"),
          busyLabel: t("linkingIngredients"),
        },
        {
          // Unguarded and destructive by decision (ADR-0025): it runs on a
          // recipe that already has a photograph and replaces the primary.
          kind: "image-generation",
          key: "generate-image",
          idleLabel: t("generateImage"),
          busyLabel: t("generatingImage"),
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
        className: cssButtonPillDanger,
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
    tPrint,
    onPrint,
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
          className={twMerge("transition active:scale-95", buttonClassName)}
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
                  className={twMerge(
                    "w-full justify-start bg-transparent",
                    cssButtonPill,
                    // An item's own pill wins over the neutral one — a danger
                    // row hovers danger, not surface.
                    item.className
                  )}
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
                    {/* The class goes on the Label itself: `.label` sets its own
                        colour, so a colour inherited from a wrapper never lands. */}
                    <Label className={twMerge("text-sm font-medium", item.labelClassName)}>
                      {item.label}
                    </Label>
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

      <MiniCookbooks open={openCookbooks} recipeIds={[id]} onOpenChange={setOpenCookbooks} />

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
