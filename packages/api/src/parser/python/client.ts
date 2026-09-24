import {
  buildInternalParserApiUrl,
  INTERNAL_PARSER_API_URL,
  SERVER_CONFIG,
} from "@norish/config/env-config-server";
import { parserLogger as log, redactUrl } from "@norish/shared-server/logger";
import { ErrorWithDetail } from "@norish/shared/lib/error-extensions";

import type { RecipeScrapersParserRequest, RecipeScrapersParserResponse } from "./contract";
import { RecipeScrapersParserRequestSchema, RecipeScrapersParserResponseSchema } from "./contract";

const PARSE_ENDPOINT = "/parse";

/**
 * The parser's answer, and the body it arrived in exactly as the service sent
 * it, before the contract dropped or defaulted anything: when an import fails
 * the job monitor shows `raw`, which is what proves the service itself broke.
 */
export type RecipeScrapersParserReply = RecipeScrapersParserResponse & { raw: unknown };

export async function callRecipeScrapersParser(
  input: RecipeScrapersParserRequest
): Promise<RecipeScrapersParserReply> {
  const request = RecipeScrapersParserRequestSchema.parse(input);
  const baseUrl = INTERNAL_PARSER_API_URL;
  const endpoint = buildInternalParserApiUrl(PARSE_ENDPOINT);
  log.debug(input.html);
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

  const body = await response.text().catch(() => "");

  if (!response.ok) {
    log.error(
      {
        parserApiUrl: redactUrl(baseUrl),
        status: response.status,
        body,
      },
      "Recipe parser API request failed"
    );

    throw new ErrorWithDetail(`Recipe parser API request failed with status ${response.status}`, {
      status: response.status,
      body,
    });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(body);
  } catch {
    log.error({ body }, "Recipe parser API returned a body that is not JSON");
    throw new ErrorWithDetail("Recipe parser API returned a body that is not JSON", { body });
  }

  const parsed = RecipeScrapersParserResponseSchema.safeParse(payload);

  if (!parsed.success) {
    log.error({ issues: parsed.error.issues }, "Recipe parser API returned invalid payload");
    throw new ErrorWithDetail("Recipe parser API returned an invalid payload", {
      raw: payload,
      issues: parsed.error.issues,
    });
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

  return { ...parsed.data, raw: payload };
}
