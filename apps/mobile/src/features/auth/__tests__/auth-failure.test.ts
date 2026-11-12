import { authFailure } from "@/features/auth/utils/auth-failure";
import { describe, expect, it } from "vitest";

const refuse = (error: { code?: string; message?: string }) => Promise.resolve({ error });

describe("authFailure", () => {
  it("is null once the call succeeds", async () => {
    await expect(authFailure(Promise.resolve({ error: null }), "fallback")).resolves.toBeNull();
  });

  it("says wrong email or password for Better Auth's credentials refusal", async () => {
    await expect(
      authFailure(
        refuse({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }),
        "fallback"
      )
    ).resolves.toBe("auth.login.wrongCredentials");
  });

  it("translates a server code auth.errors knows", async () => {
    await expect(
      authFailure(
        refuse({ code: "REGISTRATION_IS_CURRENTLY_DISABLED", message: "Registration disabled" }),
        "fallback"
      )
    ).resolves.toBe("auth.errors.registration_is_currently_disabled.description");
    await expect(authFailure(refuse({ code: "PROVIDER_NOT_FOUND" }), "fallback")).resolves.toBe(
      "auth.errors.provider_not_found.description"
    );
  });

  it("never shows a server's own message for an unknown refusal", async () => {
    await expect(
      authFailure(refuse({ code: "EMAIL_NOT_VERIFIED", message: "Email not verified" }), "fallback")
    ).resolves.toBe("fallback");
    await expect(authFailure(refuse({ message: "Something odd" }), "fallback")).resolves.toBe(
      "fallback"
    );
  });

  it("says no server answered for a network failure, and the fallback for anything else", async () => {
    await expect(
      authFailure(Promise.reject(new TypeError("Network request failed")), "fallback")
    ).resolves.toBe("auth.connect.errors.unreachable");
    await expect(authFailure(Promise.reject(new Error("boom")), "fallback")).resolves.toBe(
      "fallback"
    );
  });
});
