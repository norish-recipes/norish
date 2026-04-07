/**
 * Resolves a potentially relative image URL to an absolute URL with auth headers
 * for use with expo-image.
 */

export type AuthenticatedImageSource = {
  uri: string;
  headers?: Record<string, string>;
};

/**
 * Resolve a potentially relative image URL against the backend base URL
 * and attach auth cookie headers if available.
 */
export function resolveImageUrl(
  image: string | null | undefined,
  backendBaseUrl: string | null,
  authCookie: string | null
): AuthenticatedImageSource | null {
  if (!image) return null;

  const uri = /^https?:\/\//i.test(image)
    ? image
    : backendBaseUrl
      ? `${backendBaseUrl.replace(/\/+$/, "")}/${image.replace(/^\/+/, "")}`
      : image;

  return {
    uri,
    ...(authCookie ? { headers: { Cookie: authCookie } } : {}),
  };
}

/**
 * Convenience: returns just the URI string (for components that don't support headers).
 */
export function resolveImageUri(
  image: string | null | undefined,
  backendBaseUrl: string | null
): string {
  if (!image) return "";
  if (/^https?:\/\//i.test(image)) return image;
  if (!backendBaseUrl) return image;

  return `${backendBaseUrl.replace(/\/+$/, "")}/${image.replace(/^\/+/, "")}`;
}
