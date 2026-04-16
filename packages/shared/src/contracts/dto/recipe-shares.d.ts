import type { z } from "zod";

import type {
  AdminRecipeShareInventorySchema,
  CreateRecipeShareInputSchema,
  PublicRecipeViewSchema,
  ReactivateRecipeShareInputSchema,
  RecipeShareCreatedSchema,
  RecipeShareDeleteResultSchema,
  RecipeShareInventorySchema,
  RecipeShareLifecycleEventSchema,
  RecipeShareMutationResultSchema,
  RecipeShareSelectSchema,
  RecipeShareSummarySchema,
  ResolveSharedRecipeInputSchema,
  UpdateRecipeShareInputSchema,
} from "@norish/shared/contracts/zod/recipe-shares";

export type RecipeShareDto = z.output<typeof RecipeShareSelectSchema>;
export type RecipeShareSummaryDto = z.output<typeof RecipeShareSummarySchema>;
export type RecipeShareManagementSummaryDto = RecipeShareSummaryDto;
export type RecipeShareInventoryDto = z.output<typeof RecipeShareInventorySchema>;
export type AdminRecipeShareInventoryDto = z.output<typeof AdminRecipeShareInventorySchema>;
export type RecipeShareCreatedDto = z.output<typeof RecipeShareCreatedSchema>;
export type RecipeShareMutationResultDto = z.output<typeof RecipeShareMutationResultSchema>;
export type RecipeShareDeleteResultDto = z.output<typeof RecipeShareDeleteResultSchema>;
export type RecipeShareLifecycleEventDto = z.output<typeof RecipeShareLifecycleEventSchema>;
export type CreateRecipeShareInputDto = z.input<typeof CreateRecipeShareInputSchema>;
export type UpdateRecipeShareInputDto = z.input<typeof UpdateRecipeShareInputSchema>;
export type ReactivateRecipeShareInputDto = z.input<typeof ReactivateRecipeShareInputSchema>;
export type ResolveSharedRecipeInputDto = z.input<typeof ResolveSharedRecipeInputSchema>;
export type PublicRecipeViewDTO = z.output<typeof PublicRecipeViewSchema>;
