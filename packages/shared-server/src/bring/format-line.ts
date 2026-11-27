import type { BringItem } from "@norish/shared/contracts/zod/bring";

const MAX_LINE_LENGTH = 200;

/** An amount with at most two decimals, trailing zeros trimmed: 0.5, 2, 1.33. */
function formatAmount(amount: number): string {
  return String(Number(amount.toFixed(2)));
}

/** Whether the amount reads as a quantity: above zero once rounded to two decimals. */
function isUsableAmount(amount: number | null | undefined): amount is number {
  return (
    amount != null && Number.isFinite(amount) && amount < 1e15 && Number(amount.toFixed(2)) > 0
  );
}

/**
 * One ingredient as the line Bring! parses ("200 g Mehl"): amount, unit, name,
 * whitespace and newlines collapsed, capped at 200 characters. An amount that is not above zero
 * (or rounds to zero) is left out.
 */
export function formatBringLine({ name, amount, unit }: BringItem): string {
  const parts = [isUsableAmount(amount) ? formatAmount(amount) : "", unit ?? "", name];

  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_LINE_LENGTH).trim();
}
