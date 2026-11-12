import { validateSignUp } from "@/features/auth/utils/validate-sign-up";
import { describe, expect, it } from "vitest";

const valid = {
  name: "Ada",
  email: "ada@example.com",
  password: "12345678",
  confirmPassword: "12345678",
};

describe("validateSignUp", () => {
  it("accepts a complete form", () => {
    expect(validateSignUp(valid)).toBeNull();
  });

  it("asks for a name or email that is empty or only spaces, name first", () => {
    expect(validateSignUp({ ...valid, name: "  " })).toEqual({
      field: "name",
      messageId: "common.validation.required",
    });
    expect(validateSignUp({ ...valid, name: "", email: "" })?.field).toBe("name");
    expect(validateSignUp({ ...valid, email: " " })).toEqual({
      field: "email",
      messageId: "common.validation.required",
    });
  });

  it("asks for a password, then holds it to 8-128 characters", () => {
    expect(validateSignUp({ ...valid, password: "" })?.messageId).toBe(
      "common.validation.required"
    );
    expect(validateSignUp({ ...valid, password: "1234567" })).toEqual({
      field: "password",
      messageId: "auth.signup.errors.passwordTooShort",
    });
    expect(validateSignUp({ ...valid, password: "a".repeat(129) })?.messageId).toBe(
      "auth.signup.errors.passwordTooLong"
    );

    const edge = { password: "a".repeat(128), confirmPassword: "a".repeat(128) };

    expect(validateSignUp({ ...valid, ...edge })).toBeNull();
  });

  it("asks to confirm the password, and says when the two differ", () => {
    expect(validateSignUp({ ...valid, confirmPassword: "" })).toEqual({
      field: "confirmPassword",
      messageId: "common.validation.required",
    });
    expect(validateSignUp({ ...valid, confirmPassword: "12345679" })).toEqual({
      field: "confirmPassword",
      messageId: "auth.signup.errors.passwordMismatch",
    });
  });
});
