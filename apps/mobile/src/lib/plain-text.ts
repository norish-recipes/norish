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
