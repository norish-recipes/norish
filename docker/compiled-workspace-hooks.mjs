// Resolves the compiled workspace the way tsx resolved its TypeScript: an extensionless or `.ts`
// relative specifier names the `.js` beside it, a directory its index, and JSON loads as JSON.
// In-thread (registerHooks), so no loader worker or esbuild process sits beside the server.
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const relative = /^\.\.?\//;
const resolvable = /\.(c|m)?js$|\.json$|\.node$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (relative.test(specifier) && !resolvable.test(specifier) && context.parentURL) {
      const base = specifier.replace(/\.tsx?$/, "");

      specifier =
        [`${base}.js`, `${base}/index.js`].find((candidate) =>
          existsSync(new URL(candidate, context.parentURL))
        ) ?? specifier;
    }

    const result = nextResolve(specifier, context);

    return result.url.endsWith(".json") && context.importAttributes?.type !== "json"
      ? { ...result, importAttributes: { ...context.importAttributes, type: "json" } }
      : result;
  },
});
