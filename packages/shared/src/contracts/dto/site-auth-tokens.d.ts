import type { z } from "zod";

import type {
  CreateSiteAuthTokenInputSchema,
  SiteAuthTokenDecryptedSchema,
  SiteAuthTokenSafeSchema,
  SiteAuthTokenSelectSchema,
  UpdateSiteAuthTokenInputSchema,
} from "@norish/shared/contracts/zod/site-auth-tokens";

export type SiteAuthTokenDto = z.output<typeof SiteAuthTokenSelectSchema>;
export type SiteAuthTokenDecryptedDto = z.output<typeof SiteAuthTokenDecryptedSchema>;
export type SiteAuthTokenSafeDto = z.output<typeof SiteAuthTokenSafeSchema>;
export type CreateSiteAuthTokenInputDto = z.input<typeof CreateSiteAuthTokenInputSchema>;
export type UpdateSiteAuthTokenInputDto = z.input<typeof UpdateSiteAuthTokenInputSchema>;
