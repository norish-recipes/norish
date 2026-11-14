export type InlineNode =
  | { kind: "text"; text: string }
  | { kind: "bold" | "italic"; children: InlineNode[] }
  | { kind: "link"; href: string; children: InlineNode[] };

// Links, then bold, then italic; underscores only mark emphasis at a word's edge, and no marker touches whitespace inside.
const INLINE =
  /\[([^\]]{0,200})\]\(([^)\s]{0,500})\)|\*\*(?!\s)([^*]+?)(?<!\s)\*\*|(?<!\w)__(?!\s)([^_]+?)(?<!\s)__(?!\w)|\*(?!\s)([^*]+?)(?<!\s)\*|(?<!\w)_(?!\s)([^_]+?)(?<!\s)_(?!\w)/g;

/** The inline markdown web's step and ingredient text renders: links, bold and italic. */
export function parseInline(markdown: string): InlineNode[] {
  const withoutImages = markdown.replace(/!\[[^\]]{0,200}\]\([^)]{0,500}\)/g, "");
  const nodes: InlineNode[] = [];
  let last = 0;

  for (const match of withoutImages.matchAll(INLINE)) {
    const [whole, label, href, bold, boldUnderscore, italic, italicUnderscore] = match;

    if (match.index > last)
      nodes.push({ kind: "text", text: withoutImages.slice(last, match.index) });
    last = match.index + whole.length;

    if (href !== undefined) {
      nodes.push({ kind: "link", href, children: parseInline(label ?? "") });
    } else {
      const bolded = bold ?? boldUnderscore;

      nodes.push({
        kind: bolded !== undefined ? "bold" : "italic",
        children: parseInline(bolded ?? italic ?? italicUnderscore ?? ""),
      });
    }
  }

  if (last < withoutImages.length) nodes.push({ kind: "text", text: withoutImages.slice(last) });

  return nodes;
}

/** Where a link goes: the web, another recipe (`id:`), or nowhere, so its label reads as text. */
export function linkTarget(
  href: string
): { to: "web"; url: string } | { to: "recipe"; id: string } | null {
  if (/^https?:\/\//i.test(href)) return { to: "web", url: href };

  const id = href.match(/^id:([a-zA-Z0-9-]+)$/)?.[1];

  return id ? { to: "recipe", id } : null;
}
