export type IngredientLinkSource = {
  ingredientName: string;
  systemUsed: string;
  amount?: number | string | null;
  unit?: string | null;
  order?: number | string | null;
};

export type IngredientLinkCandidate = {
  key: string;
  ingredientName: string;
  amount: number | string | null;
  unit: string | null;
  normalizedName: string;
  systemUsed: string;
  order: number;
};

const SINGLE_WORD_STOP_CHARS = /[\s@{}\[\](),;:!?.]/;
const MARKDOWN_LABEL_ESCAPE = /[\\\[\]]/g;

export function normalizeIngredientLinkName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getIngredientLinkCandidateKey(input: {
  ingredientName: string;
  systemUsed: string;
}): string {
  return `${input.systemUsed}:${normalizeIngredientLinkName(input.ingredientName)}`;
}

export function createIngredientLinkCandidates(
  ingredients: IngredientLinkSource[],
  systemUsed: string
): IngredientLinkCandidate[] {
  const seen = new Set<string>();

  return ingredients
    .filter((ingredient) => ingredient.systemUsed === systemUsed)
    .map((ingredient, fallbackOrder) => {
      const ingredientName = ingredient.ingredientName.trim();
      const order = Number(ingredient.order ?? fallbackOrder);

      return {
        ingredientName,
        amount: ingredient.amount ?? null,
        unit: ingredient.unit ?? null,
        normalizedName: normalizeIngredientLinkName(ingredientName),
        systemUsed: ingredient.systemUsed,
        order: Number.isFinite(order) ? order : fallbackOrder,
      };
    })
    .filter((ingredient) => {
      if (!ingredient.normalizedName || ingredient.ingredientName.startsWith("#")) return false;

      const key = `${ingredient.systemUsed}:${ingredient.normalizedName}`;

      if (seen.has(key)) return false;
      seen.add(key);

      return true;
    })
    .sort((a, b) => a.order - b.order)
    .map((ingredient) => ({
      ...ingredient,
      key: `${ingredient.systemUsed}:${ingredient.normalizedName}`,
    }));
}

export function formatIngredientLinkToken(name: string, amountLabel?: string | null): string {
  const normalized = name.trim().replace(/\s+/g, " ");
  const amount = amountLabel?.trim();

  if (!normalized) return "@";

  if (amount) {
    return `@${normalized.replace(/[{}]/g, "").trim()}{${amount.replace(/[{}]/g, "").trim()}}`;
  }

  if (!SINGLE_WORD_STOP_CHARS.test(normalized)) {
    return `@${normalized}`;
  }

  return `@${normalized.replace(/[{}]/g, "").trim()}{}`;
}

export function formatIngredientLinkAmount(input: {
  amount?: number | string | null;
  unit?: string | null;
}): string {
  return [formatTokenAmount(input.amount), input.unit?.trim()].filter(Boolean).join(" ");
}

export function applyIngredientLinkMarkup(
  text: string,
  candidates: IngredientLinkCandidate[]
): string {
  if (!text || candidates.length === 0) return text;

  const candidateByName = new Map(
    candidates.map((candidate) => [candidate.normalizedName, candidate])
  );
  let result = "";
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char === "\\" && text[index + 1] === "@") {
      result += "@";
      index += 2;
      continue;
    }

    if (char !== "@") {
      result += char;
      index += 1;
      continue;
    }

    const previousChar = index > 0 ? (text[index - 1] ?? "") : "";

    if (/[A-Za-z0-9_]/.test(previousChar)) {
      result += char;
      index += 1;
      continue;
    }

    const multiwordMatch = readBracedIngredientToken(text, index);

    if (multiwordMatch) {
      const candidate = candidateByName.get(normalizeIngredientLinkName(multiwordMatch.name));

      if (candidate) {
        result += toIngredientMarkdownLink(candidate, multiwordMatch.amountLabel);
        index = multiwordMatch.endIndex;
        continue;
      }

      result += text.slice(index, multiwordMatch.endIndex);
      index = multiwordMatch.endIndex;
      continue;
    }

    const singleWordMatch = readSingleWordIngredientToken(text, index);

    if (singleWordMatch) {
      const candidate = candidateByName.get(normalizeIngredientLinkName(singleWordMatch.name));

      if (candidate) {
        result += toIngredientMarkdownLink(candidate);
        index = singleWordMatch.endIndex;
        continue;
      }
    }

    result += char;
    index += 1;
  }

  return result;
}

export function isIngredientLinkHref(href: string | undefined): boolean {
  return Boolean(href?.startsWith("norish-ingredient:"));
}

export function parseIngredientLinkHref(href: string | undefined): string | null {
  if (!href?.startsWith("norish-ingredient:")) return null;

  return decodeURIComponent(href.slice("norish-ingredient:".length));
}

function readBracedIngredientToken(
  text: string,
  startIndex: number
): { name: string; amountLabel: string; endIndex: number } | null {
  const openBraceIndex = text.indexOf("{", startIndex + 1);

  if (openBraceIndex === -1) return null;

  const closeBraceIndex = text.indexOf("}", openBraceIndex + 1);

  if (closeBraceIndex === -1) return null;

  const rawName = text.slice(startIndex + 1, openBraceIndex);
  const amountLabel = text.slice(openBraceIndex + 1, closeBraceIndex).trim();

  if (
    !rawName.trim() ||
    rawName.includes("@") ||
    rawName.includes("\n") ||
    amountLabel.includes("\n")
  ) {
    return null;
  }

  return {
    name: rawName,
    amountLabel,
    endIndex: closeBraceIndex + 1,
  };
}

function readSingleWordIngredientToken(
  text: string,
  startIndex: number
): { name: string; endIndex: number } | null {
  let endIndex = startIndex + 1;

  while (endIndex < text.length && !SINGLE_WORD_STOP_CHARS.test(text[endIndex] ?? "")) {
    endIndex += 1;
  }

  if (endIndex === startIndex + 1) return null;

  return {
    name: text.slice(startIndex + 1, endIndex),
    endIndex,
  };
}

function toIngredientMarkdownLink(
  candidate: IngredientLinkCandidate,
  amountLabel?: string
): string {
  const label = formatIngredientLinkLabel(candidate.ingredientName, amountLabel).replace(
    MARKDOWN_LABEL_ESCAPE,
    "\\$&"
  );
  const href = `norish-ingredient:${encodeURIComponent(candidate.key)}`;

  return `[${label}](${href})`;
}

function formatIngredientLinkLabel(name: string, amountLabel?: string): string {
  const amount = amountLabel?.trim();

  if (!amount) return name;

  return `${name} (${amount})`;
}

function formatTokenAmount(amount: number | string | null | undefined): string {
  if (amount == null || amount === "") return "";

  const numberAmount = typeof amount === "string" ? Number(amount) : amount;

  if (!Number.isFinite(numberAmount)) return String(amount).trim();
  if (Number.isInteger(numberAmount)) return String(numberAmount);

  return String(numberAmount).replace(/\.?0+$/, "");
}
