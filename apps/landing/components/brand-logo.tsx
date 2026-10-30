import { asset } from "@/lib/assets";

type BrandLogoProps = {
  className?: string;
  width?: number;
  height?: number;
  /** The paper-coloured wordmark, for the green band. */
  cream?: boolean;
};

/**
 * Norish wordmark. Uses the same logo.svg shipped with the product (forest-green
 * #336640), which reads correctly on both light and dark surfaces.
 */
export function BrandLogo({ className, width = 97, height = 26, cream = false }: BrandLogoProps) {
  return (
    <img
      alt="Norish"
      className={className}
      height={height}
      src={asset(cream ? "/logo-cream.svg" : "/logo.svg")}
      width={width}
    />
  );
}
