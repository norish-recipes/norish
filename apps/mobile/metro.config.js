import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getDefaultConfig } = require("expo/metro-config");
const { wrapWithReanimatedMetroConfig } = require(
  "react-native-reanimated/metro-config"
);
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(dirname(fileURLToPath(import.meta.url)));

const reanimatedConfig = wrapWithReanimatedMetroConfig(config);

export default withUniwindConfig(reanimatedConfig, {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-env.d.ts",
});
