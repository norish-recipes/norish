import React from "react";
import ThemedShot from "./ThemedShot";

type PhoneMockupProps = {
  /** Base filename without the -light/-dark suffix, e.g. "dashboard-mobile". */
  base: string;
  alt: string;
};

// Phone bezel wrapping a themed mobile screenshot — a CSS port of the landing
// page's PhoneFrame.
export default function PhoneMockup({ base, alt }: PhoneMockupProps) {
  return (
    <div className="phoneMockup">
      <ThemedShot base={base} alt={alt} />
    </div>
  );
}
