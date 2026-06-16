import {
  buildInternalParserApiUrl,
  INTERNAL_PARSER_API_URL,
  SERVER_CONFIG,
} from "@norish/config/env-config-server";
import { parserLogger as log, redactUrl } from "@norish/shared-server/logger";

import type { RecipeScrapersParserRequest, RecipeScrapersParserResponse } from "./contract";
import { RecipeScrapersParserRequestSchema, RecipeScrapersParserResponseSchema } from "./contract";

const PARSE_ENDPOINT = "/parse";

export async function callRecipeScrapersParser(
  input: RecipeScrapersParserRequest
): Promise<RecipeScrapersParserResponse> {
  const request = RecipeScrapersParserRequestSchema.parse(input);
  const baseUrl = INTERNAL_PARSER_API_URL;
  const endpoint = buildInternalParserApiUrl(PARSE_ENDPOINT);

  log.debug(
    {
      parserApiUrl: redactUrl(baseUrl),
      timeoutMs: SERVER_CONFIG.PARSER_API_TIMEOUT_MS,
      url: request.url,
    },
    "Calling recipe-scrapers parser API"
  );

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(SERVER_CONFIG.PARSER_API_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    log.error(
      {
        parserApiUrl: redactUrl(baseUrl),
        status: response.status,
        body,
      },
      "Recipe parser API request failed"
    );

    throw new Error(`Recipe parser API request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const parsed = RecipeScrapersParserResponseSchema.safeParse(payload);

  if (!parsed.success) {
    log.error({ issues: parsed.error.issues }, "Recipe parser API returned invalid payload");
    throw new Error("Recipe parser API returned an invalid payload");
  }

  if (!parsed.data.ok) {
    log.warn(
      {
        error: parsed.data.error,
        parser: parsed.data.parser,
        url: request.url,
      },
      "Recipe parser API returned a structured parser failure"
    );
  }

  return parsed.data;
}
