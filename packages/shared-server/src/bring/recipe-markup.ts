import type { BringHandoff } from "./handoff-store";

type HandoffContent = Pick<BringHandoff, "title" | "servings" | "lines"> &
  Partial<Pick<BringHandoff, "image">>;

/** Where the page is served: AUTH_URL without a trailing slash, and the handoff's token. */
type HandoffPage = { baseUrl: string; token: string };

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * The picture Bring! shows beside the items: a stored one through the handoff's own `/image`
 * address, which carries no recipe id; an imported one at the address it came from; and the
 * brand icon for a recipe with none, because Bring!'s parser wants an image.
 */
function imageUrlFor(handoff: HandoffContent, { baseUrl, token }: HandoffPage): string {
  const image = handoff.image;

  if (!image) return `${baseUrl}/brand/icon-512.png`;
  if ("url" in image) return image.url;

  return `${baseUrl}/share/bring/${token}/image`;
}

/** The schema.org Recipe Bring! reads. */
export function jsonLdFor(handoff: HandoffContent, page: HandoffPage): string {
  const json = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: handoff.title,
    author: { "@type": "Organization", name: "Norish" },
    image: [imageUrlFor(handoff, page)],
    recipeYield: String(Math.max(1, Math.round(handoff.servings))),
    recipeIngredient: handoff.lines,
  });

  // Inside a <script> element: `<` could close it, U+2028/2029 end a JS line.
  return json
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

/**
 * The public page for a handoff: the title and the lines, nothing about who sent them. Its
 * language is fixed: Bring!'s parser reads the JSON-LD and needs none.
 */
export function renderHandoffHtml(handoff: HandoffContent, page: HandoffPage): string {
  const title = escapeHtml(handoff.title);
  const items = handoff.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");

  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="robots" content="noindex,nofollow,noarchive"><title>${title}</title>` +
    `<script type="application/ld+json">${jsonLdFor(handoff, page)}</script>` +
    `</head><body><h1>${title}</h1><ul>${items}</ul></body></html>`
  );
}
