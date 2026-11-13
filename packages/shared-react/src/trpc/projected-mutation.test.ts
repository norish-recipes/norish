import type { MutationFunctionContext } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { projectedMutation } from "./projected-mutation";

const context: MutationFunctionContext = { client: new QueryClient(), meta: undefined };

describe("projectedMutation", () => {
  it("keeps the procedure's key and sends the projected input", async () => {
    const send = vi.fn(async (input: { id: string }) => `sent ${input.id}`);
    const options = projectedMutation(
      { mutationKey: [["ingredients", "merge"]], mutationFn: send },
      (draft: { id: string; name: string }) => ({ id: draft.id })
    );

    expect(options.mutationKey).toEqual([["ingredients", "merge"]]);
    await expect(options.mutationFn({ id: "onion", name: "Onion" }, context)).resolves.toBe(
      "sent onion"
    );
    expect(send).toHaveBeenCalledWith({ id: "onion" }, context);
  });

  it("refuses options that carry no send", () => {
    const options = projectedMutation({}, (draft: string) => draft);

    expect(() => options.mutationFn("onion", context)).toThrow();
  });
});
