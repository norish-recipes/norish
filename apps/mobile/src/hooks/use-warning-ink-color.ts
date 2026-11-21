import { useTokenColor } from "@/hooks/use-token-color";

/** The dark ink on a warning-tinted button: brown in light, the warning itself in dark. */
export function useWarningInkColor(): string | undefined {
  return useTokenColor("warning-ink");
}
