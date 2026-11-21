/**
 * A server package as Node loaded it for the custom server. Turbopack bundles workspace packages
 * whatever `serverExternalPackages` says, so a static import would run a second copy of the backend.
 */
export function serverPackage<T>(specifier: string): Promise<T> {
  return import(/* turbopackIgnore: true */ /* webpackIgnore: true */ specifier);
}
