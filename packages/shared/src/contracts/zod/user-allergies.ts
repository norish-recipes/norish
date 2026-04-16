import z from "zod";

export const UserAllergiesSchema = z.object({
  allergies: z.array(z.string()),
  version: z.number().int().nonnegative(),
});

export const UpdateUserAllergiesSchema = z.object({
  allergies: z.array(z.string().min(1).max(50)),
  version: z.number().int().nonnegative(),
});

export type UserAllergiesDto = z.infer<typeof UserAllergiesSchema>;
export type UpdateUserAllergiesInput = z.infer<typeof UpdateUserAllergiesSchema>;
