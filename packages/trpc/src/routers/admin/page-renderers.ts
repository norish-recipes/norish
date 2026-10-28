import { z } from "zod";

import type { PageRenderersConfig } from "@norish/config/zod/server-config";
import { PageRenderersConfigSchema, ServerConfigKeys } from "@norish/config/zod/server-config";
import { getConfig, setConfig } from "@norish/db/repositories/server-config";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { testPageRenderer as testEndpoint } from "@norish/shared-server/page-renderers";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

/** The Page Renderers setting, its CDP token masked. */
const getPageRenderers = adminProcedure.query(async () =>
  getConfig<PageRenderersConfig>(ServerConfigKeys.PAGE_RENDERERS)
);

/**
 * Save the Page Renderers setting. A masked or omitted CDP token keeps the stored one for the same
 * endpoint; an empty token clears it, and a new endpoint without a token of its own drops it.
 */
const updatePageRenderers = adminProcedure
  .input(PageRenderersConfigSchema)
  .mutation(async ({ input, ctx }) => {
    log.info(
      {
        userId: ctx.user.id,
        obscura: input.obscura.enabled,
        chromium: input.chromium.enabled,
        solver: input.solver.enabled,
      },
      "Updating Page Renderers"
    );

    const stored = await getConfig<PageRenderersConfig>(ServerConfigKeys.PAGE_RENDERERS);
    // The token is a credential for one host, so it never follows the endpoint to another.
    const endpointChanged = !!stored && stored.obscura.endpoint !== input.obscura.endpoint;

    await setConfig(ServerConfigKeys.PAGE_RENDERERS, input, ctx.user.id, true, {
      dropSecrets: input.obscura.cdpToken === "" || endpointChanged ? ["cdpToken"] : [],
    });

    return { success: true };
  });

/** Test the Chromium browser or the solver at an endpoint, saved or not. */
const testPageRenderer = adminProcedure
  .input(z.object({ renderer: z.enum(["chromium", "solver"]), endpoint: z.string().trim().min(1) }))
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, renderer: input.renderer }, "Testing a Page Renderer");

    return testEndpoint(input.renderer, input.endpoint);
  });

export const pageRenderersProcedures = router({
  getPageRenderers,
  updatePageRenderers,
  testPageRenderer,
});
