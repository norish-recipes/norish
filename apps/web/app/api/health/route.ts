import { NextResponse } from "next/server";

import { buildInternalParserApiUrl, SERVER_CONFIG } from "@norish/config/env-config-server";

export async function GET() {
  const parserHealthUrl = buildInternalParserApiUrl("/health");

  try {
    const response = await fetch(parserHealthUrl, {
      signal: AbortSignal.timeout(SERVER_CONFIG.PARSER_API_TIMEOUT_MS),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          status: "degraded",
          parser: {
            status: "error",
            statusCode: response.status,
          },
        },
        { status: 503 }
      );
    }

    const parserHealth = (await response.json()) as {
      status?: string;
      recipeScrapersVersion?: string;
    };

    if (parserHealth.status !== "ok") {
      return NextResponse.json(
        {
          status: "degraded",
          parser: {
            status: parserHealth.status ?? "unknown",
            recipeScrapersVersion: parserHealth.recipeScrapersVersion,
          },
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "ok",
      parser: {
        status: "ok",
        recipeScrapersVersion: parserHealth.recipeScrapersVersion,
      },
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        parser: {
          status: "unreachable",
        },
      },
      { status: 503 }
    );
  }
}
