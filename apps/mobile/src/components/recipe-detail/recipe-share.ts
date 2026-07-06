import type { CreateRecipeShareInputDto, RecipeShareCreatedDto } from "@norish/shared/contracts";

type SharePayload = {
  message: string;
  title: string;
  url: string;
};

type ShareRecipeOptions = {
  recipeName: string;
  baseUrl: string;
  createShare: (
    expiresIn?: CreateRecipeShareInputDto["expiresIn"]
  ) => Promise<RecipeShareCreatedDto | null>;
  nativeShare: (content: SharePayload) => Promise<unknown>;
};

export function resolveRecipeShareUrl(baseUrl: string, shareUrl: string): string {
  return new URL(shareUrl, baseUrl).toString();
}

export async function shareRecipeFromMenu({
  recipeName,
  baseUrl,
  createShare,
  nativeShare,
}: ShareRecipeOptions): Promise<string> {
  const createdShare = await createShare("forever");

  if (!createdShare) {
    throw new Error("Recipe share creation did not return a public URL");
  }

  const publicUrl = resolveRecipeShareUrl(baseUrl, createdShare.url);

  await nativeShare({
    message: `${recipeName}\n${publicUrl}`,
    title: recipeName,
    url: publicUrl,
  });

  return publicUrl;
}
