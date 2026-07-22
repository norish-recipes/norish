import type { AnchorHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

type CTAButtonProps = {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  external?: boolean;
  className?: string;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className">;

const base =
  "group inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground shadow-[0_10px_30px_-12px] shadow-accent/60 hover:-translate-y-0.5 hover:shadow-accent/80 active:translate-y-0",
  secondary:
    "border border-border bg-surface/70 text-foreground backdrop-blur hover:-translate-y-0.5 hover:bg-surface-secondary active:translate-y-0",
  ghost: "text-foreground hover:bg-surface-secondary",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-[0.95rem]",
};

/** Link styled as a button. Renders a real anchor for accessibility + SEO. */
export function CTAButton({
  href,
  children,
  variant = "primary",
  size = "md",
  external,
  className,
  ...rest
}: CTAButtonProps) {
  const externalProps = external ? { target: "_blank", rel: "noreferrer" } : {};

  return (
    <a
      className={`${base} ${variants[variant]} ${sizes[size]} ${className ?? ""}`}
      href={href}
      {...externalProps}
      {...rest}
    >
      {children}
    </a>
  );
}
