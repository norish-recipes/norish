"use client";

import { useState } from "react";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

import { useConnectivity } from "../offline/react";
import { usePlatform } from "../platform";
import { useCookbookRecipesQuery } from "./use-cookbook-recipes-query";
import { useCookbooksMutations } from "./use-cookbooks-mutations";

/** A cover the reader picked: the file to upload and the address to preview it at. */
export type CookbookCover = { file: Blob; preview: string };

/** What a staged edit changes, and whether there is anything to save. */
export function cookbookEditPlan(
  cookbook: Pick<CookbookSummaryDTO, "title" | "image">,
  staged: { title: string; removed: string[]; hasCover: boolean; clearImage: boolean }
) {
  const trimmed = staged.title.trim();
  const titleChanged = trimmed.length > 0 && trimmed !== cookbook.title;
  const imageChanged = staged.hasCover || (staged.clearImage && cookbook.image !== null);

  return {
    trimmed,
    titleChanged,
    imageChanged,
    isDirty: titleChanged || imageChanged || staged.removed.length > 0,
  };
}

/**
 * A cookbook's edit, staged: its title, its cover and the recipes to take out are applied together
 * by `save`, in that order, so closing without saving changes nothing. `save` takes the cover as an
 * argument when the caller has just picked one and saves at once.
 */
export function useCookbookEdit(
  cookbook: CookbookSummaryDTO,
  { withMembers = true }: { withMembers?: boolean } = {}
) {
  const { toast } = usePlatform();
  const { isOffline } = useConnectivity();
  // Every staged edit commits through the same seam, so the edit has one way to write.
  const { updateCookbook, uploadCookbookImage, setMembership } = useCookbooksMutations();
  const members = useCookbookRecipesQuery(cookbook.id, {}, { enabled: withMembers });
  const [title, setTitle] = useState(cookbook.title);
  const [removed, setRemoved] = useState<string[]>([]);
  const [picked, setPicked] = useState<CookbookCover | null>(null);
  const [clearImage, setClearImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const plan = cookbookEditPlan(cookbook, {
    title,
    removed,
    hasCover: picked !== null,
    clearImage,
  });

  /** Resolves false when the cover could not be uploaded, and then writes nothing. */
  const save = async (cover: Blob | null = picked?.file ?? null) => {
    const { trimmed, titleChanged, imageChanged } = cookbookEditPlan(cookbook, {
      title,
      removed,
      hasCover: cover !== null,
      clearImage,
    });
    let image: string | null | undefined;

    if (cover) {
      setIsSaving(true);

      try {
        image = await uploadCookbookImage(cookbook.id, cover);
      } catch {
        setIsSaving(false);
        toast.show({
          severity: "danger",
          title: toast.translate("recipes.cookbooks.imageUploadFailed"),
        });

        return false;
      }

      setIsSaving(false);
    } else if (imageChanged) {
      image = null;
    }

    if (titleChanged || imageChanged) {
      updateCookbook({
        id: cookbook.id,
        title: titleChanged ? trimmed : cookbook.title,
        image,
        version: cookbook.version,
      });
    }

    if (removed.length > 0) {
      setMembership({ cookbookId: cookbook.id, recipeIds: removed, isMember: false, cookbook });
      // The member list is this cookbook's own read, so drop the rows now rather than waiting
      // for a refetch that Offline never comes.
      for (const recipeId of removed) members.removeMember(recipeId);
    }

    return true;
  };

  return {
    title,
    setTitle,
    removed,
    toggleRemoved: (recipeId: string) =>
      setRemoved((previous) =>
        previous.includes(recipeId)
          ? previous.filter((id) => id !== recipeId)
          : [...previous, recipeId]
      ),
    picked,
    pickCover: (cover: CookbookCover) => {
      setPicked(cover);
      setClearImage(false);
    },
    clearCover: () => {
      setPicked(null);
      setClearImage(true);
    },
    /** The cover as it will be: the picked one, none once cleared, else the saved one. */
    shownImage: picked?.preview ?? (clearImage ? null : cookbook.image),
    /** Covers are uploaded to the server, so they cannot change Offline. */
    coverDisabled: isOffline,
    isDirty: plan.isDirty,
    isSaving,
    members,
    save,
  };
}
