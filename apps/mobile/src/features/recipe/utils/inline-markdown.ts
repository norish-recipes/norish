export type InlineNode =
  | { kind: "text"; text: string }
  | { kind: "bold" | "italic"; children: InlineNode[] }
  | { kind: "link"; href: string; children: InlineNode[] };

// Links, then bold, then italic; underscores only mark emphasis at a word's edge, and no marker touches whitespace inside.
const INLINE =
  /\\([*_])|\[([^\]]{0,200})\]\(((?:[^()\s]|\([^()\s]*\)){0,500})\)|\*\*(?!\s)([^*]+?)(?<!\s)\*\*|(?<!\w)__(?!\s)([^_]+?)(?<!\s)__(?!\w)|\*(?!\s)([^*]+?)(?<!\s)\*|(?<!\w)_(?!\s)([^_]+?)(?<!\s)_(?!\w)/g;

/** The inline markdown web's step and ingredient text renders: links, bold and italic. */
export function parseInline(markdown: string): InlineNode[] {
  const withoutImages = markdown.replace(/!\[[^\]]{0,200}\]\((?:[^()]|\([^()]*\)){0,500}\)/g, "");
  const nodes: InlineNode[] = [];
  let last = 0;

  for (const match of withoutImages.matchAll(INLINE)) {
    const [whole, escaped, label, href, bold, boldUnderscore, italic, italicUnderscore] = match;

    if (match.index > last)
      nodes.push({ kind: "text", text: withoutImages.slice(last, match.index) });
    last = match.index + whole.length;

    if (escaped !== undefined) {
      nodes.push({ kind: "text", text: escaped });
    } else if (href !== undefined) {
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

  return nodes.reduce<InlineNode[]>((merged, node) => {
    const before = merged.at(-1);

    if (node.kind === "text" && before?.kind === "text") before.text += node.text;
    else merged.push(node);

    return merged;
  }, []);
}

/** Where a link goes: the web or a mail address, another recipe (`id:`), or nowhere, so its label reads as text. */
export function linkTarget(
  href: string
): { to: "web"; url: string } | { to: "recipe"; id: string } | null {
  if (/^(https?:\/\/|mailto:)/i.test(href)) return { to: "web", url: href };

  const id = href.match(/^id:([a-zA-Z0-9-]+)$/)?.[1];

  return id ? { to: "recipe", id } : null;
}
