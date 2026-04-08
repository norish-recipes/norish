from __future__ import annotations

import json
import logging
from typing import Any, Literal
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from recipe_scrapers import scrape_html
from recipe_scrapers.__version__ import __version__ as RECIPE_SCRAPERS_VERSION
from recipe_scrapers._exceptions import NoSchemaFoundInWildMode
from recipe_scrapers._exceptions import RecipeSchemaNotFound
from recipe_scrapers._exceptions import RecipeScrapersExceptions
from recipe_scrapers._exceptions import WebsiteNotImplementedError


FailureCode = Literal[
    "WebsiteNotImplementedError",
    "NoSchemaFoundInWildMode",
    "RecipeSchemaNotFound",
    "ParserError",
]


class ParseRequest(BaseModel):
    url: HttpUrl
    html: str = Field(min_length=1)


class ParserMetadata(BaseModel):
    mode: Literal["supported", "wild"]
    scraper: str
    host: str | None = None
    siteName: str | None = None
    version: str


class EmbeddedVideo(BaseModel):
    contentUrl: HttpUrl | None = None
    url: HttpUrl | None = None
    thumbnailUrl: HttpUrl | list[HttpUrl] | None = None
    duration: str | None = None
    name: str | None = None
    description: str | None = None


class ParserMedia(BaseModel):
    images: list[HttpUrl] = Field(default_factory=list)
    videos: list[EmbeddedVideo] = Field(default_factory=list)


class ParseSuccess(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    ok: Literal[True] = True
    canonicalUrl: HttpUrl | None = None
    parser: ParserMetadata
    recipe: dict[str, Any]
    media: ParserMedia = Field(default_factory=ParserMedia)


class ParseFailure(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    ok: Literal[False] = False
    error: FailureCode
    message: str
    parser: ParserMetadata | None = None


ParseResponse = ParseSuccess | ParseFailure

app = FastAPI(title="Norish Parser API", version="0.1.0")
logger = logging.getLogger("uvicorn.error")


def _trimmed(value: Any) -> str | None:
    if not isinstance(value, str):
        return None

    trimmed = value.strip()
    return trimmed or None


def _dedupe_urls(candidates: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []

    for candidate in candidates:
        normalized = _trimmed(candidate)
        if not normalized or normalized in seen:
            continue

        seen.add(normalized)
        ordered.append(normalized)

    return ordered


def _resolve_url(candidate: Any, base_url: str) -> str | None:
    value = _trimmed(candidate)
    if not value:
        return None

    resolved = urljoin(base_url, value)
    parsed = urlparse(resolved)

    if parsed.scheme not in {"http", "https"}:
        return None

    return resolved


def _resolve_url_list(candidates: list[str], base_url: str) -> list[str]:
    resolved: list[str] = []

    for candidate in candidates:
        normalized = _resolve_url(candidate, base_url)
        if normalized:
            resolved.append(normalized)

    return _dedupe_urls(resolved)


def _resolve_thumbnail_urls(value: Any, base_url: str) -> str | list[str] | None:
    if isinstance(value, list):
        resolved = _resolve_url_list([item for item in value if isinstance(item, str)], base_url)
        return resolved or None

    return _resolve_url(value, base_url)


def _flatten_images(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]

    if isinstance(value, list):
        flattened: list[str] = []
        for item in value:
            flattened.extend(_flatten_images(item))
        return flattened

    if isinstance(value, dict):
        candidates: list[str] = []
        for key in ("url", "contentUrl", "thumbnailUrl", "image"):
            if key in value:
                candidates.extend(_flatten_images(value[key]))
        return candidates

    return []


def _extract_json_ld_roots(html: str) -> list[Any]:
    soup = BeautifulSoup(html, "html.parser")
    roots: list[Any] = []

    for element in soup.select('script[type="application/ld+json"]'):
        raw_json = element.string or element.get_text() or ""
        raw_json = raw_json.strip()

        if not raw_json:
            continue

        try:
            parsed = json.loads(raw_json)
        except json.JSONDecodeError:
            continue

        roots.append(parsed)

    return roots


def _extract_embedded_videos(html: str, base_url: str) -> list[EmbeddedVideo]:
    collected: list[EmbeddedVideo] = []

    def visit(node: Any) -> None:
        if isinstance(node, list):
            for item in node:
                visit(item)
            return

        if not isinstance(node, dict):
            return

        raw_type = node.get("@type") or node.get("type")
        types = raw_type if isinstance(raw_type, list) else [raw_type]
        lowered_types = {str(value).lower() for value in types if value}

        if "videoobject" in lowered_types:
            try:
                content_url = _resolve_url(node.get("contentUrl"), base_url)
                page_url = _resolve_url(node.get("url"), base_url)
                thumbnail_url = _resolve_thumbnail_urls(node.get("thumbnailUrl"), base_url)

                if not content_url and not page_url:
                    return

                collected.append(
                    EmbeddedVideo(
                        contentUrl=content_url,
                        url=page_url,
                        thumbnailUrl=thumbnail_url,
                        duration=_trimmed(node.get("duration")),
                        name=_trimmed(node.get("name")),
                        description=_trimmed(node.get("description")),
                    )
                )
            except Exception:
                pass

        for value in node.values():
            visit(value)

    for root in _extract_json_ld_roots(html):
        visit(root)

    deduped: list[EmbeddedVideo] = []
    seen_keys: set[str] = set()

    for video in collected:
        key = f"{video.contentUrl}|{video.url}|{video.name}"
        if key in seen_keys:
            continue

        seen_keys.add(key)
        deduped.append(video)

    return deduped


def _extract_image_candidates(html: str, recipe: dict[str, Any], base_url: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    candidates: list[str] = []

    candidates.extend(_flatten_images(recipe.get("image")))

    for selector in (
        'meta[property="og:image"]',
        'meta[property="og:image:url"]',
        'meta[name="twitter:image"]',
        'meta[property="twitter:image"]',
    ):
        content = soup.select_one(selector)
        if content and content.get("content"):
            candidates.append(content["content"])

    for root in _extract_json_ld_roots(html):
        candidates.extend(_flatten_images(root))

    return _resolve_url_list(candidates, base_url)


def _build_parser_metadata(scraper: Any, mode: Literal["supported", "wild"]) -> ParserMetadata:
    host = None
    site_name = None

    try:
        host = _trimmed(scraper.host())
    except Exception:
        pass

    try:
        site_name = _trimmed(scraper.site_name())
    except Exception:
        pass

    return ParserMetadata(
        mode=mode,
        scraper=type(scraper).__name__,
        host=host,
        siteName=site_name,
        version=RECIPE_SCRAPERS_VERSION,
    )


def _map_failure_code(error: Exception) -> FailureCode:
    if isinstance(error, WebsiteNotImplementedError):
        return "WebsiteNotImplementedError"
    if isinstance(error, NoSchemaFoundInWildMode):
        return "NoSchemaFoundInWildMode"
    if isinstance(error, RecipeSchemaNotFound):
        return "RecipeSchemaNotFound"
    return "ParserError"


def _run_scraper(html: str, url: str) -> tuple[Any, Literal["supported", "wild"]]:
    try:
        return scrape_html(html=html, org_url=url, best_image=True), "supported"
    except WebsiteNotImplementedError:
        return scrape_html(html=html, org_url=url, wild_mode=True, best_image=True), "wild"


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "recipeScrapersVersion": RECIPE_SCRAPERS_VERSION,
    }


@app.post("/parse", response_model=ParseResponse)
def parse_recipe(request: ParseRequest) -> ParseResponse:
    request_url = str(request.url)

    try:
        scraper, mode = _run_scraper(request.html, request_url)
        parser = _build_parser_metadata(scraper, mode)
        recipe = scraper.to_json()

        logger.info(
            "parser scrape success url=%s scraper=%s mode=%s",
            request_url,
            parser.scraper,
            parser.mode,
        )

        canonical_url = None
        try:
            canonical_url = _trimmed(scraper.canonical_url())
        except Exception:
            canonical_url = None

        response = ParseSuccess(
            canonicalUrl=canonical_url,
            parser=parser,
            recipe=recipe,
            media=ParserMedia(
                images=_extract_image_candidates(request.html, recipe, request_url),
                videos=_extract_embedded_videos(request.html, request_url),
            ),
        )

        return response
    except RecipeScrapersExceptions as error:
        response = ParseFailure(
            error=_map_failure_code(error),
            message=str(error),
            parser=ParserMetadata(
                mode="wild" if isinstance(error, NoSchemaFoundInWildMode) else "supported",
                scraper="unknown",
                version=RECIPE_SCRAPERS_VERSION,
            ),
        )

        logger.warning(
            "parser scraper error url=%s error=%s",
            request_url,
            type(error).__name__,
        )

        return response
    except Exception as error:
        response = ParseFailure(
            error="ParserError",
            message=str(error),
            parser=ParserMetadata(
                mode="supported",
                scraper="unknown",
                version=RECIPE_SCRAPERS_VERSION,
            ),
        )

        logger.exception(
            "parser unexpected error url=%s",
            request_url,
        )

        return response
