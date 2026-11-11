import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import ProfileCard from "@/features/account/components/profile-card";

const mockAccount = vi.hoisted(() => ({
  user: { name: "Alice", email: "alice@example.com", image: null },
  updateName: vi.fn().mockResolvedValue(undefined),
  uploadAvatar: vi.fn().mockResolvedValue(undefined),
  deleteAvatar: vi.fn().mockResolvedValue(undefined),
  isDeletingAvatar: false,
}));

let mockUser: { name: string; email: string; image: string | null } = mockAccount.user;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@norish/shared-react/reader", () => ({
  useProfileQuery: () => ({ user: mockUser, apiKeys: [] }),
  useProfileMutations: () => mockAccount,
}));

vi.mock("@heroui/react", () => ({
  Card: Object.assign(({ children }: any) => <div>{children}</div>, {
    Header: ({ children }: any) => <div>{children}</div>,
    Content: ({ children }: any) => <div>{children}</div>,
  }),
  TextField: ({ children, value, onChange, isReadOnly, isDisabled }: any) => (
    <input
      disabled={isDisabled}
      readOnly={isReadOnly}
      value={value}
      aria-label={children?.props?.children ?? undefined}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
  Label: ({ children }: any) => <span>{children}</span>,
  Input: () => null,
  Button: ({ children, onPress, isDisabled, type = "button" }: any) => (
    <button disabled={isDisabled} type={type} onClick={onPress}>
      {children}
    </button>
  ),
}));

class MockFileReader {
  public onload: ((event: { target: { result: string } }) => void) | null = null;

  readAsDataURL() {
    this.onload?.({ target: { result: "data:image/png;base64,preview" } });
  }
}

describe("ProfileCard", () => {
  beforeEach(() => {
    vi.stubGlobal("FileReader", MockFileReader);
    mockUser = { name: "Alice", email: "alice@example.com", image: null };
  });

  it("enables save and uploads avatar only after save", async () => {
    const { container } = render(<ProfileCard />);
    const saveButton = screen.getByRole("button", { name: "save" });

    expect(saveButton).toBeDisabled();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    expect(fileInput).toBeTruthy();

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });

    expect(mockAccount.uploadAvatar).not.toHaveBeenCalled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockAccount.uploadAvatar).toHaveBeenCalledTimes(1);
    });
    expect(mockAccount.uploadAvatar).toHaveBeenCalledWith(file);
    expect(mockAccount.updateName).not.toHaveBeenCalled();
  });

  it("uses plain avatar URL without cache-busting query params", () => {
    mockUser = {
      name: "Alice",
      email: "alice@example.com",
      image: "/avatars/user-1.png",
    };

    render(<ProfileCard />);

    const avatar = screen.getByRole("img", { name: "Alice" });
    const src = avatar.querySelector("img")?.getAttribute("src");

    expect(src).toBe("/avatars/user-1.png");
  });
});
