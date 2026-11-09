import { isUrl } from "@norish/shared/lib/helpers";

type SearchParam = string | string[] | undefined;

const LINK_IN_TEXT = /https?:\/\/\S+/i;

function firstValue(param: SearchParam): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

/**
 * The recipe link a bookmarklet or a phone's share sheet sent to the import
 * page. A bookmarklet fills `url`; Android's share sheet often leaves that
 * empty and puts the link in `text`, sometimes after the page's title.
 */
export function readImportLink({ url, text }: { url: SearchParam; text: SearchParam }) {
  const candidates = [firstValue(url)?.trim(), firstValue(text)?.match(LINK_IN_TEXT)?.[0]];

  return candidates.find((candidate) => candidate && isUrl(candidate)) ?? null;
}

/**
 * The bookmarklet that sends the current page to `importPageUrl`, with the
 * reader's private code so the import starts at once. It opens a new tab so
 * the recipe stays open, and takes over the current tab when the browser's
 * pop-up blocker refuses one.
 */
export function buildBookmarklet(importPageUrl: string, code: string): string {
  const target = JSON.stringify(`${importPageUrl}?code=${encodeURIComponent(code)}&url=`);

  // A bookmarklet is a javascript: address by definition, and nothing here comes from a visitor.
  // eslint-disable-next-line sonarjs/code-eval
  return `javascript:(function(){var u=${target}+encodeURIComponent(location.href);if(!window.open(u,"_blank"))location.href=u})()`;
}
