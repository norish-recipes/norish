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
  // The wordmark is sized by width everywhere it appears, and its intrinsic
  // ratio (2370:639) does not match the width/height pairs callers ask for.
  // Letting the height follow keeps the ratio honest and silences Next's
  // "width or height modified, but not the other" warning.
  const classes = ["h-auto", className].filter(Boolean).join(" ");

  return (
    <Image
      alt="Norish logo"
      className={classes}
      height={height}
      priority={priority}
      src="/logo.svg"
      width={width}
    />
  );
}
