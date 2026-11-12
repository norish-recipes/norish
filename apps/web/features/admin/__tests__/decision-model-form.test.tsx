/**
 * Decision Model form: the endpoint (#620). A self-hosted or gateway TypeSafe
 * server is only reachable when the typed endpoint reaches both Test and Save.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { configs, setConfigs } from "./admin-config-fake";

const updateDecisionConfig = vi.fn();
const testDecisionEndpoint = vi.fn();

vi.mock("@norish/shared-react/admin", async () => ({
  useAdminConfig: (await import("./admin-config-fake")).useAdminConfig,
  useDecisionConfigMutations: () => ({ save: updateDecisionConfig, test: testDecisionEndpoint }),
  useConfigSecret: () => vi.fn(),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const { default: DecisionModelForm } =
  await import("@/features/admin/components/ai/decision-model-form");

describe("DecisionModelForm endpoint", () => {
  beforeEach(() => {
    testDecisionEndpoint.mockResolvedValue({ success: true });
    updateDecisionConfig.mockResolvedValue(undefined);
    setConfigs({ decision_config: { provider: "typesafe", apiKey: "••••", model: "von-1.3.0" } });
  });

  it("tests and saves the endpoint as typed", async () => {
    render(<DecisionModelForm />);

    fireEvent.change(screen.getByRole("textbox", { name: "endpoint" }), {
      target: { value: "http://litellm:4000/typesafe/v1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "test" }));
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    expect(testDecisionEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "http://litellm:4000/typesafe/v1" })
    );
    expect(updateDecisionConfig).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "http://litellm:4000/typesafe/v1", model: "von-1.3.0" })
    );
  });

  it("an emptied endpoint saves as the default", () => {
    configs.decision_config = {
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

  it.each([
    ["keeps the typed key when the save failed", null, "sk-new"],
    ["clears the typed key once the save went through", { success: true }, ""],
  ])("%s", async (_, answer, left) => {
    updateDecisionConfig.mockResolvedValue(answer);
    render(<DecisionModelForm />);
    const key = screen.getByLabelText("apiKey");

    fireEvent.change(key, { target: { value: "sk-new" } });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    // Lets the save's answer land before reading the field.
    await act(async () => {});

    expect(updateDecisionConfig).toHaveBeenCalled();
    expect(key).toHaveValue(left);
  });
});
