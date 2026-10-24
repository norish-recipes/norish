/**
 * Decision Model form: the endpoint (#620). A self-hosted or gateway TypeSafe
 * server is only reachable when the typed endpoint reaches both Test and Save.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

const updateDecisionConfig = vi.fn();
const testDecisionEndpoint = vi.fn();
const context = vi.hoisted(() => ({ decisionConfig: undefined as unknown }));

vi.mock("@/app/(app)/settings/admin/context", () => ({
  useAdminSettingsContext: () => ({
    decisionConfig: context.decisionConfig,
    aiConfig: { enabled: true },
    updateDecisionConfig,
    testDecisionEndpoint,
    fetchConfigSecret: vi.fn(),
  }),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const { default: DecisionModelForm } =
  await import("@/app/(app)/settings/admin/components/decision-model-form");

describe("DecisionModelForm endpoint", () => {
  beforeEach(() => {
    testDecisionEndpoint.mockResolvedValue({ success: true });
    updateDecisionConfig.mockResolvedValue(undefined);
    context.decisionConfig = { provider: "typesafe", apiKey: "••••", model: "von-1.3.0" };
  });

  it("tests and saves the endpoint as typed", async () => {
    render(<DecisionModelForm />);

    fireEvent.change(screen.getByRole("textbox", { name: "endpoint" }), {
      target: { value: "http://litellm:4000/typesafe/v1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /testConnection/ }));
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    expect(testDecisionEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "http://litellm:4000/typesafe/v1" })
    );
    expect(updateDecisionConfig).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "http://litellm:4000/typesafe/v1", model: "von-1.3.0" })
    );
  });

  it("an emptied endpoint saves as the default", () => {
    context.decisionConfig = {
      provider: "typesafe",
      apiKey: "••••",
      endpoint: "http://von:8080/v1",
    };
    render(<DecisionModelForm />);

    fireEvent.change(screen.getByRole("textbox", { name: "endpoint" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    expect(updateDecisionConfig).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: undefined })
    );
  });
});
