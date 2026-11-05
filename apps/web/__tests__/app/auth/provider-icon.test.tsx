import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { ProviderIcon } from "@/app/(auth)/login/components/provider-icon";

import { SIGN_IN_METHODS } from "@norish/shared/contracts/dto/auth";

describe("ProviderIcon", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(Object.values(SIGN_IN_METHODS))(
    "draws $id without asking the network",
    ({ icon, name }) => {
      const fetch = vi.fn();

      vi.stubGlobal("fetch", fetch);

      const { container } = render(<ProviderIcon icon={icon} providerName={name} width={18} />);
      const svg = container.querySelector("svg");

      expect(svg?.querySelector("path")).toBeInTheDocument();
      expect(svg).toHaveAttribute("width", "18");
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it("shows initials for an icon it does not have", () => {
    render(<ProviderIcon icon="mdi:unknown" providerName="Company Login" />);

    expect(screen.getByText("CL")).toBeInTheDocument();
  });
});
