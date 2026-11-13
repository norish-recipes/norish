declare module "*.svg" {
  import type React from "react";
  import type { SvgProps } from "react-native-svg";
  const content: React.FC<SvgProps>;
  export default content;
}

// Reached only through @norish/trpc's emitted server types; never bundled.
declare module "heic-convert";
