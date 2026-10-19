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
    vi.clearAllMocks();
    testDecisionEndpoint.mockResolvedValue({ success: true });
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

describe("DecisionModelForm generic OpenAI-compatible provider", () => {
  beforeEach(() => {
    context.decisionConfig = {
      provider: "generic-openai",
      apiKey: "••••",
      model: "my-model",
      endpoint: "https://provider.example/api/v4",
    };
  });

  it("tests and saves its own endpoint and model", () => {
    render(<DecisionModelForm />);

    fireEvent.change(screen.getByRole("textbox", { name: "endpoint" }), {
      target: { value: "https://provider.example/api/v4/" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "model" }), {
      target: { value: "other-model" },
    });
    fireEvent.click(screen.getByRole("button", { name: /testConnection/ }));
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    expect(testDecisionEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "generic-openai",
        endpoint: "https://provider.example/api/v4/",
        model: "other-model",
      })
    );
    expect(updateDecisionConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "generic-openai",
        endpoint: "https://provider.example/api/v4/",
        model: "other-model",
      })
    );
  });

  it("cannot test or save until the endpoint and model are typed", () => {
    context.decisionConfig = {
      provider: "generic-openai",
      apiKey: "••••",
      model: "",
      endpoint: "",
    };
    render(<DecisionModelForm />);

    expect(screen.getByRole("button", { name: /testConnection/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
  });

  it("cannot test or save without a stored or typed key", () => {
    context.decisionConfig = {
      provider: "generic-openai",
      model: "my-model",
      endpoint: "https://provider.example/api/v4",
    };
    render(<DecisionModelForm />);

    expect(screen.getByLabelText("apiKey")).toBeRequired();
    expect(screen.getByRole("button", { name: /testConnection/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
  });

  it("a typed key enables test and save", () => {
    context.decisionConfig = {
      provider: "generic-openai",
      model: "my-model",
      endpoint: "https://provider.example/api/v4",
    };
    render(<DecisionModelForm />);

    fireEvent.change(screen.getByLabelText("apiKey"), { target: { value: "new-key" } });

    expect(screen.getByRole("button", { name: /testConnection/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: "save" })).toBeEnabled();
  });

  it("a stored key enables test and save", () => {
    context.decisionConfig = {
      provider: "generic-openai",
      apiKey: "••••",
      model: "my-model",
      endpoint: "https://provider.example/api/v4",
    };
    render(<DecisionModelForm />);

    fireEvent.change(screen.getByRole("textbox", { name: "endpoint" }), {
      target: { value: "https://provider.example/api/v5" },
    });

    expect(screen.getByRole("button", { name: /testConnection/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: "save" })).toBeEnabled();
  });
});
