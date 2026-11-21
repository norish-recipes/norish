/** Markdown as plain text: links keep their label, emphasis and heading marks go. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]{0,200}\]\([^)]{0,500}\)/g, "")
    .replace(/\[([^\]]{0,200})\]\([^)]{0,500}\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#+\s*/gm, "")
    .trim();
}

/** A cut-out of markdown as plain text: also drops the marks the cut left unpaired. */
export function snippetText(markdown: string): string {
  return plainText(markdown)
    .replace(/!?\[([^\]]{0,200})\]\([^)]{0,500}$/, "$1")
    .replace(/(^|\s)[*_]+(?=\S)/g, "$1")
    .replace(/([^\s*_])[*_]+(?=$|[\s.,;:!?)])/g, "$1")
    .replace(/^#+\s*/, "")
    .trim();
}
