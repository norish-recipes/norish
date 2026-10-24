// @vitest-environment node

import { NextRequest } from "next/server";
import { DESTINATION_HEADER } from "@/lib/auth/login-redirect";
import { config, proxy } from "@/proxy";
import { describe, expect, it } from "vitest";

const proxied = new RegExp(`^${config.matcher[0]}$`);

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { headers });
}

describe("the proxy", () => {
  it("sends a request without a session cookie to sign in, and back to where it was going", () => {
    const response = proxy(request("/recipes/123e4567-e89b-12d3-a456-426614174000?tab=steps"));

    expect(response.status).toBe(307);

    const location = new URL(response.headers.get("location")!);

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("callbackUrl")).toBe(
      "/recipes/123e4567-e89b-12d3-a456-426614174000?tab=steps"
    );
  });

  it("lets a request with a session cookie through, forwarding where it was going", () => {
    const response = proxy(
      request("/groceries?store=1", { cookie: "better-auth.session_token=anything" })
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get(`x-middleware-request-${DESTINATION_HEADER}`)).toBe(
      "/groceries?store=1"
    );
  });

  it("lets a request with an API key through, for the route to check", () => {
    const response = proxy(request("/recipes/x/cover.jpg", { "x-api-key": "key" }));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("the proxy matcher", () => {
  it("excludes public PWA assets", () => {
    expect(config.matcher[0]).toContain("manifest\\.webmanifest");
    expect(config.matcher[0]).toContain("sw\\.js");
    expect(config.matcher[0]).toContain("brand");
    expect(config.matcher[0]).toContain("icons");
    // The worker script itself (/serwist/sw.js, below): browsers fetch it
    // without credentials, and a script answered by a redirect is refused, so
    // it can never sit behind the auth redirect.
    expect(config.matcher[0]).toContain("serwist");
  });

  it("leaves the brand icons and the N mark out, so installs fetch them signed out", () => {
    expect(proxied.test("/brand/apple-touch-icon.png")).toBe(false);
    expect(proxied.test("/brand/splash/light-1206x2622.png")).toBe(false);
    expect(proxied.test("/logo-small.svg")).toBe(false);
  });

  it("leaves Ingredient Icons out, so a shared recipe shows them signed out", () => {
    expect(proxied.test("/ingredient-icons/0123456789abcdef0123456789abcdef.webp")).toBe(false);
    expect(proxied.test("/recipes/123e4567-e89b-12d3-a456-426614174000/cover.jpg")).toBe(true);
  });

  it("leaves shared recipes and their media out: the share token is their check", () => {
    expect(proxied.test("/share/public-token")).toBe(false);
    expect(proxied.test("/share/public-token/media/cover.jpg")).toBe(false);
  });

  it.each(["/login", "/login/", "/icons/x.png", "/sw.js", "/serwist/sw.js", "/api/auth/session"])(
    "leaves %s out",
    (path) => {
      expect(proxied.test(path)).toBe(false);
    }
  );

  // A prefix ends at a path boundary, so a future page that merely starts with
  // one is not public by accident.
  it.each(["/login-history", "/icons-admin", "/sw.json", "/api/v10", "/trpc-console", "/shared"])(
    "sends %s through",
    (path) => {
      expect(proxied.test(path)).toBe(true);
    }
  );
});
