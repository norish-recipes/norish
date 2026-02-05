/**
 * Theme CSS Loader
 * Dynamically loads external theme CSS from a configured URL
 */

const THEME_LINK_ID = "norish-custom-theme";

/**
 * Load theme CSS from external URL
 * Injects a <link> tag into the document head if URL is provided
 */
export function loadThemeCSS(cssUrl: string | null | undefined): void {
  // Remove existing theme link if it exists
  const existing = document.getElementById(THEME_LINK_ID);
  if (existing) {
    existing.remove();
  }

  // If no URL provided, just remove the link
  if (!cssUrl) {
    return;
  }

  // Validate URL is HTTPS or localhost for security
  try {
    const url = new URL(cssUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      console.warn("[Theme Loader] Theme CSS URL must be HTTPS or localhost:", cssUrl);
      return;
    }
  } catch {
    console.warn("[Theme Loader] Invalid theme CSS URL:", cssUrl);
    return;
  }

  // Create and inject link tag
  const link = document.createElement("link");
  link.id = THEME_LINK_ID;
  link.rel = "stylesheet";
  link.href = cssUrl;
  link.media = "all";

  // Add error handling
  link.onerror = () => {
    console.error("[Theme Loader] Failed to load theme CSS from:", cssUrl);
    link.remove();
  };

  document.head.appendChild(link);
  console.log("[Theme Loader] Theme CSS loaded from:", cssUrl);
}

/**
 * Remove custom theme CSS
 */
export function removeThemeCSS(): void {
  const existing = document.getElementById(THEME_LINK_ID);
  if (existing) {
    existing.remove();
    console.log("[Theme Loader] Custom theme CSS removed");
  }
}
