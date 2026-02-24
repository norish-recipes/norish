import type { z } from "zod";

import type {
  SaveCaldavConfigInputSchema,
  UserCaldavConfigDecryptedSchema,
  UserCaldavConfigInsertSchema,
  UserCaldavConfigSelectSchema,
  UserCaldavConfigUpdateSchema,
} from "@norish/shared/contracts/zod/caldav-config";

export type UserCaldavConfigDto = z.output<typeof UserCaldavConfigSelectSchema>;
export type UserCaldavConfigInsertDto = z.input<typeof UserCaldavConfigInsertSchema>;
export type UserCaldavConfigUpdateDto = z.input<typeof UserCaldavConfigUpdateSchema>;
export type UserCaldavConfigDecryptedDto = z.output<typeof UserCaldavConfigDecryptedSchema>;
export type UserCaldavConfigWithoutPasswordDto = Omit<UserCaldavConfigDecryptedDto, "password">;
export type SaveCaldavConfigInputDto = z.input<typeof SaveCaldavConfigInputSchema>;
