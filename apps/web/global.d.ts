declare module "*.css";

declare namespace NodeJS {
  interface ProcessEnv {
    /** Inlined by `next.config.js` from the root package.json at build time. */
    readonly NEXT_PUBLIC_APP_VERSION: string;
  }
}
