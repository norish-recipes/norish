/** The Version row's message and values: the app's version and build, and the server's when known. */
export function versionLine(app: string, build: string, server: string | undefined) {
  return server
    ? { id: "settings.mobile.versionWithServer", values: { app, build, server } }
    : { id: "settings.mobile.versionApp", values: { app, build } };
}
