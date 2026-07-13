import { AuthProviders } from "@/app/providers/auth-providers";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/providers/base-providers", () => ({
  BaseProviders: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("AuthProviders", () => {
  it("keeps the authenticated application interactive without a connection overlay", () => {
    render(
      <AuthProviders>
        <button type="button">Continue working</button>
      </AuthProviders>
    );

    expect(screen.getByRole("button", { name: "Continue working" })).toBeEnabled();
    expect(screen.queryByText("Connecting to Norish...")).not.toBeInTheDocument();
  });
});
