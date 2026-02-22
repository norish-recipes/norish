const PASTEL_COLORS = [
  "#F2BFC6",
  "#F6D5A7",
  "#EFE189",
  "#BFE3B2",
  "#B6E0D8",
  "#BDD7F5",
  "#CCC4F4",
  "#E7BFEF",
];

const PASTEL_TEXT_COLOR = "#1F2937";

function hashString(input: string): number {
  let hash = 0;

  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

export function getAvatarPastelColor(seed: string): string {
  if (!seed) return PASTEL_COLORS[0];

  const index = hashString(seed) % PASTEL_COLORS.length;

  return PASTEL_COLORS[index];
}

export function getAvatarFallbackStyle(seed: string): { backgroundColor: string; color: string } {
  return {
    backgroundColor: getAvatarPastelColor(seed),
    color: PASTEL_TEXT_COLOR,
  };
}
