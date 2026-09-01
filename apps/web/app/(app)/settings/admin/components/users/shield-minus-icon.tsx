import type { SVGProps } from "react";

/**
 * A shield with a minus cut out of it, drawn to match Heroicons 16/solid.
 *
 * Granting admin access uses their ShieldCheck; revoking it needs the same
 * shield with the mark reversed, which Heroicons does not ship — its only
 * other shield carries an exclamation, and that reads as "something is wrong"
 * rather than "this is being taken away". The outline below is ShieldCheck's,
 * unchanged, so the two buttons sit at exactly the same weight.
 */
export function ShieldMinusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      data-slot="icon"
      fill="currentColor"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        clipRule="evenodd"
        d="M8.5 1.709a.75.75 0 0 0-1 0 8.963 8.963 0 0 1-4.84 2.217.75.75 0 0 0-.654.72 10.499 10.499 0 0 0 5.647 9.672.75.75 0 0 0 .694-.001 10.499 10.499 0 0 0 5.647-9.672.75.75 0 0 0-.654-.719A8.963 8.963 0 0 1 8.5 1.71Zm1.75 5.541a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5h4.5Z"
        fillRule="evenodd"
      />
    </svg>
  );
}
