import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import ProfileCard from "@/app/(app)/settings/user/components/profile-card";

const mockContext = vi.hoisted(() => ({
  user: { name: "Alice", email: "alice@example.com", image: null },
  updateName: vi.fn().mockResolvedValue(undefined),
  updateImage: vi.fn().mockResolvedValue(undefined),
  deleteImage: vi.fn().mockResolvedValue(undefined),
  isDeletingAvatar: false,
}));

let mockUser: { name: string; email: string; image: string | null } = mockContext.user;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/app/(app)/settings/user/context", () => ({
  useUserSettingsContext: () => ({ ...mockContext, user: mockUser }),
}));

vi.mock("@heroui/react", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardBody: ({ children }: any) => <div>{children}</div>,
  Avatar: ({ onClick, src }: any) => (
    <button aria-label="avatar-trigger" type="button" onClick={onClick}>
      <img alt="profile avatar" src={src} />
    </button>
  ),
  Input: ({ value, onValueChange, isReadOnly, isDisabled }: any) => (
    <input
      disabled={isDisabled}
      readOnly={isReadOnly}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    />
  ),
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
    vi.clearAllMocks();
    vi.stubGlobal("FileReader", MockFileReader);
    mockUser = { name: "Alice", email: "alice@example.com", image: null };
  });

  it("enables save and uploads avatar only after save", async () => {
    const { container } = render(<ProfileCard />);
    const saveButton = screen.getByRole("button", { name: "saveChanges" });

    expect(saveButton).toBeDisabled();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    expect(fileInput).toBeTruthy();

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });

    expect(mockContext.updateImage).not.toHaveBeenCalled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockContext.updateImage).toHaveBeenCalledTimes(1);
    });
    expect(mockContext.updateImage).toHaveBeenCalledWith(file);
    expect(mockContext.updateName).not.toHaveBeenCalled();
  });

  it("refreshes avatar src when user updates with same image path", async () => {
    mockUser = {
      name: "Alice",
      email: "alice@example.com",
      image: "/avatars/user-1.png",
    };

    const { rerender } = render(<ProfileCard />);

    const firstSrc = screen.getByAltText("profile avatar").getAttribute("src");

    mockUser = {
      name: "Alice Updated",
      email: "alice@example.com",
      image: "/avatars/user-1.png",
    };

    rerender(<ProfileCard />);

    await waitFor(() => {
      const secondSrc = screen.getByAltText("profile avatar").getAttribute("src");

      expect(secondSrc).not.toBe(firstSrc);
    });
  });
});
