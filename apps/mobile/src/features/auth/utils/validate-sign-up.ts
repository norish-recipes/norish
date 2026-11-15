import { z } from "zod";

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@norish/shared/lib/auth/password";

type SignUpField = "name" | "email" | "password" | "confirmPassword";

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type SignUpMessageId =
  | "common.validation.required"
  | "common.validation.invalidEmail"
  | "auth.signup.errors.passwordTooShort"
  | "auth.signup.errors.passwordTooLong"
  | "auth.signup.errors.passwordMismatch";

/** The first field that can't be submitted and the message id saying why, or null. */
export function validateSignUp(
  input: SignUpInput
): { field: SignUpField; messageId: SignUpMessageId } | null {
  const { name, email, password, confirmPassword } = input;

  if (name.trim() === "") return { field: "name", messageId: "common.validation.required" };
  if (email.trim() === "") return { field: "email", messageId: "common.validation.required" };
  if (!z.email().safeParse(email.trim()).success)
    return { field: "email", messageId: "common.validation.invalidEmail" };
  if (password === "") return { field: "password", messageId: "common.validation.required" };

  if (password.length < MIN_PASSWORD_LENGTH)
    return { field: "password", messageId: "auth.signup.errors.passwordTooShort" };
  if (password.length > MAX_PASSWORD_LENGTH)
    return { field: "password", messageId: "auth.signup.errors.passwordTooLong" };

  if (confirmPassword === "")
    return { field: "confirmPassword", messageId: "common.validation.required" };
  if (password !== confirmPassword)
    return { field: "confirmPassword", messageId: "auth.signup.errors.passwordMismatch" };

  return null;
}
