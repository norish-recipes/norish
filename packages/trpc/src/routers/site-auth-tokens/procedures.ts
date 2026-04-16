import {
  createSiteAuthToken,
  deleteSiteAuthToken,
  getTokensByUserId,
  updateSiteAuthToken,
} from "@norish/db/repositories/site-auth-tokens";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  CreateSiteAuthTokenInputSchema,
  DeleteSiteAuthTokenInputSchema,
  UpdateSiteAuthTokenInputSchema,
} from "@norish/shared/contracts/zod/site-auth-tokens";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

const create = authedProcedure
  .input(CreateSiteAuthTokenInputSchema)
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, domain: input.domain }, "Creating site auth token");
    const token = await createSiteAuthToken(ctx.user.id, input);

    log.info(
      { userId: ctx.user.id, tokenId: token.id, domain: input.domain },
      "Site auth token created"
    );

    return token;
  });

const list = authedProcedure.query(async ({ ctx }) => {
  const tokens = await getTokensByUserId(ctx.user.id);

  return tokens;
});

const update = authedProcedure
  .input(UpdateSiteAuthTokenInputSchema)
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, tokenId: input.id }, "Updating site auth token");
    const result = await updateSiteAuthToken(ctx.user.id, input);

    if (result.stale || !result.value) {
      log.info(
        { userId: ctx.user.id, tokenId: input.id, version: input.version },
        "Ignoring stale site auth token update"
      );

      return { stale: true };
    }

    log.info({ userId: ctx.user.id, tokenId: result.value.id }, "Site auth token updated");

    return { ...result.value, stale: false };
  });

const remove = authedProcedure
  .input(DeleteSiteAuthTokenInputSchema)
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, tokenId: input.id }, "Deleting site auth token");
    const result = await deleteSiteAuthToken(ctx.user.id, input.id, input.version);

    if (result.stale) {
      log.info(
        { userId: ctx.user.id, tokenId: input.id, version: input.version },
        "Ignoring stale site auth token delete"
      );

      return { success: true, stale: true };
    }

    log.info({ userId: ctx.user.id, tokenId: input.id }, "Site auth token deleted");

    return { success: true, stale: false };
  });

export const siteAuthTokensProcedures = router({ create, list, update, remove });
