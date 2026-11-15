import * as Linking from "expo-linking";

/** A typed route as a link that opens the app from outside: `[name]` segments filled, the rest as query. */
export function routeUrl(pathname: string, params: Record<string, string> = {}): string {
  const query = { ...params };
  const path = pathname.replace(/\[(\w+)\]/g, (_, name: string) => {
    const value = query[name] ?? "";

    delete query[name];

    return encodeURIComponent(value);
  });

  return Linking.createURL(path, { queryParams: query });
}
