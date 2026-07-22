import React from "react";

type ThemedShotProps = {
  /** Base filename without the -light/-dark suffix, e.g. "dashboard-web". */
  base: string;
  alt: string;
};

// Renders the light and dark variant of a screenshot and toggles between them
// purely with CSS based on Docusaurus's html[data-theme] attribute (mirrors the
// landing page's ThemedShot). The correct variant shows immediately, no flash.
export default function ThemedShot({ base, alt }: ThemedShotProps) {
  return (
    <>
      <img
        className="themedShot themedShot--light"
        src={`/img/screenshots/${base}-light.jpg`}
        alt={alt}
        loading="eager"
      />
      <img
        className="themedShot themedShot--dark"
        src={`/img/screenshots/${base}-dark.jpg`}
        alt={alt}
        loading="eager"
      />
    </>
  );
}
