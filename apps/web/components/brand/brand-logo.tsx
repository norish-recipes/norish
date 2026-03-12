import Image from "next/image";

type BrandLogoProps = {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  width = 120,
  height = 30,
  className,
  priority = false,
}: BrandLogoProps) {
  // const classes = ["object-contain", "dark:brightness-0", "dark:invert", className]
  //   .filter(Boolean)
  //   .join(" ");

  return (
    <Image
      alt="Norish logo"
      className={className}
      height={height}
      priority={priority}
      src="/logo.svg"
      width={width}
    />
  );
}
