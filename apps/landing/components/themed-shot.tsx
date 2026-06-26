import Image from "next/image";

type ThemedShotProps = {
  /** Base filename without the -light/-dark suffix, e.g. "dashboard-web". */
  base: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

/**
 * Renders the light and dark variant of a screenshot and toggles between them
 * purely with CSS (`block dark:hidden` / `hidden dark:block`). Because
 * next-themes sets the theme class on <html> before paint, the correct variant
 * shows immediately with no hydration flash.
 */
export function ThemedShot({
  base,
  alt,
  width,
  height,
  className,
  sizes,
  priority,
}: ThemedShotProps) {
  const shared = { alt, width, height, sizes } as const;

  return (
    <>
      <Image
        {...shared}
        className={`block dark:hidden ${className ?? ""}`}
        priority={priority}
        src={`/screenshots/${base}-light.jpg`}
      />
      <Image
        {...shared}
        className={`hidden dark:block ${className ?? ""}`}
        loading={priority ? "eager" : "lazy"}
        src={`/screenshots/${base}-dark.jpg`}
      />
    </>
  );
}
