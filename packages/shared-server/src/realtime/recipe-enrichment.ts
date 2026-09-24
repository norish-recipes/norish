import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { recipeEnrichmentRealtime } from "@norish/shared/contracts/realtime/recipe-enrichment";

export const recipeEnrichment = defineRealtimeDomain(recipeEnrichmentRealtime);
