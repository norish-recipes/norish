import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
};

/**
 * Norish wordmark. Uses the same logo.svg shipped with the product (forest-green
 * #336640), which reads correctly on both light and dark surfaces. next/image
 * handles basePath prefixing automatically.
 */
export function BrandLogo({ className, width = 116, height = 31, priority }: BrandLogoProps) {
  return (
    <Image
      alt="Norish"
      className={className}
      height={height}
      priority={priority}
      src="/logo.svg"
      width={width}
    />
  );
}
