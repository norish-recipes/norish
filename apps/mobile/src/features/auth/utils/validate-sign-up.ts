export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

// Only the shape; the server decides the rest.
const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;

export type SignUpField = "name" | "email" | "password" | "confirmPassword";

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export type SignUpMessageId =
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
  if (!EMAIL_SHAPE.test(email.trim()))
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
