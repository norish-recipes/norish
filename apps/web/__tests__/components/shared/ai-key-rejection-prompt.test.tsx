/**
 * The AI-key prompt: an admin is told on any page that a configured key is refused; nobody else
 * asks the admin-only read.
 */
import { readAnswers, sentReads } from "@/__tests__/helpers/trpc-fake";
import AIKeyRejectionPrompt from "@/components/shared/ai-key-rejection-prompt";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

const { showActionToast, reader } = vi.hoisted(() => ({
  showActionToast: vi.fn(),
  reader: { isServerAdmin: false },
}));

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
vi.mock("@norish/shared-react/reader", () => ({
  usePermissions: <T,>(select: (permissions: typeof reader) => T) => select(reader),
}));
vi.mock("@/lib/ui/action-toast", () => ({ showActionToast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useFormatter: () => ({ list: (items: string[]) => items.join(", "), dateTime: () => "today" }),
}));

const renderPrompt = () =>
  render(<AIKeyRejectionPrompt />, {
    wrapper: createTestWrapper(createTestQueryClient(), fakePlatformAdapter()),
  });

beforeEach(() => {
  sentReads.mockReset();
  showActionToast.mockReset();
  window.sessionStorage.clear();
  readAnswers.set("admin.aiKeyRejections", async () => [
    { block: "ai_config", since: "2026-11-01T10:00:00.000Z" },
  ]);
});

describe("AIKeyRejectionPrompt", () => {
  it("tells an admin a configured key is refused", async () => {
    reader.isServerAdmin = true;
    renderPrompt();

    await waitFor(() =>
      expect(showActionToast).toHaveBeenCalledWith(
        "common.aiKeyRejected.title",
        expect.objectContaining({ variant: "danger" })
      )
    );
  });

  it("asks nothing for a reader who isn't an admin", async () => {
    reader.isServerAdmin = false;
    renderPrompt();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sentReads).not.toHaveBeenCalledWith("admin.aiKeyRejections", undefined);
    expect(showActionToast).not.toHaveBeenCalled();
  });
});
