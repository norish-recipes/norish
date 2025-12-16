import z from "zod";

export const UserAllergiesSchema = z.object({
  allergies: z.array(z.string()),
});

export const UpdateUserAllergiesSchema = z.object({
  allergies: z.array(z.string().min(1).max(50)),
});

export type UserAllergiesDto = z.infer<typeof UserAllergiesSchema>;
export type UpdateUserAllergiesInput = z.infer<typeof UpdateUserAllergiesSchema>;
