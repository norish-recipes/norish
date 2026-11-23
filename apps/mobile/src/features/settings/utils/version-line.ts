/** The Version row's text: the installed app's version and build, then the server's, each only when known. */
export function versionLine(version: string | null, build: string | null, server: string | null) {
  const app = version && build ? `${version} (${build})` : version;
  return [app, server].filter(Boolean).join(" · ");
}
