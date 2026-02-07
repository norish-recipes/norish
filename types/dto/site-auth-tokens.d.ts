import type { z } from "zod";
import type {
  SiteAuthTokenSelectSchema,
  SiteAuthTokenDecryptedSchema,
  SiteAuthTokenSafeSchema,
  CreateSiteAuthTokenInputSchema,
  UpdateSiteAuthTokenInputSchema,
} from "@/server/db/zodSchemas/site-auth-tokens";

export type SiteAuthTokenDto = z.output<typeof SiteAuthTokenSelectSchema>;
export type SiteAuthTokenDecryptedDto = z.output<typeof SiteAuthTokenDecryptedSchema>;
export type SiteAuthTokenSafeDto = z.output<typeof SiteAuthTokenSafeSchema>;
export type CreateSiteAuthTokenInputDto = z.input<typeof CreateSiteAuthTokenInputSchema>;
export type UpdateSiteAuthTokenInputDto = z.input<typeof UpdateSiteAuthTokenInputSchema>;
