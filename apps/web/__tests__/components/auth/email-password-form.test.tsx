import { EmailPasswordForm } from "@/app/(auth)/login/components/email-password-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signInEmail } = vi.hoisted(() => ({ signInEmail: vi.fn() }));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
vi.mock("@norish/shared/lib/auth/client", () => ({ signIn: { email: signInEmail } }));

const SIGN_IN = "auth.emailPassword.signIn";

function submit() {
  fireEvent.change(screen.getByLabelText(/auth.emailPassword.email/), {
    target: { value: "cook@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/auth.emailPassword.password/), {
    target: { value: "secret-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: SIGN_IN }));
}

beforeEach(() => signInEmail.mockReset());

describe("EmailPasswordForm", () => {
  it("keeps the button busy after signing in, while the redirect loads the app", async () => {
    signInEmail.mockResolvedValue({ data: { redirect: true }, error: null });
    render(<EmailPasswordForm />);

    submit();
    await waitFor(() => expect(signInEmail).toHaveBeenCalledTimes(1));
    await new Promise((settled) => setTimeout(settled, 0));

    expect(screen.getByRole("button", { name: SIGN_IN })).toHaveAttribute("data-pending");
  });

  it("frees the button again when the sign-in is refused", async () => {
    signInEmail.mockResolvedValue({ data: null, error: { message: "Invalid" } });
    render(<EmailPasswordForm />);

    submit();
    await screen.findByText("Invalid");

    expect(screen.getByRole("button", { name: SIGN_IN })).not.toHaveAttribute("data-pending");
  });
});
