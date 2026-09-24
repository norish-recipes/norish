/** Mock for @norish/shared-server/realtime/recipe-enrichment */
import { recipeEnrichmentRealtime } from "@norish/shared/contracts/realtime/recipe-enrichment";

import { createFakeRealtimeDomain } from "../realtime";

export const recipeEnrichment = createFakeRealtimeDomain(recipeEnrichmentRealtime);
