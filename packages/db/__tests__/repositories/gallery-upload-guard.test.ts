// @vitest-environment node
/**
 * The upload cap is decided inside one transaction, under the recipe row lock.
 * Two uploads for one recipe cannot both read the same count and pass, so the
 * count and the insert are proven here as one locked unit (ADR-0040).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addGalleryImageWithinCap } from "@norish/db/repositories/recipes";

const state = vi.hoisted(() => ({
  transaction: vi.fn(),
  forUpdate: vi.fn(),
  insertValues: vi.fn(),
}));

vi.mock("@norish/db/drizzle", () => ({
  db: { transaction: state.transaction },
}));

function mockTransaction({
  recipeExists = true,
  sourceImages = 0,
  maxOrder = null as string | null,
} = {}) {
  let selectCall = 0;

  state.transaction.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: () => {
        selectCall += 1;

        if (selectCall === 1) {
          return {
            from: () => ({
              where: () => ({
                for: (strength: string) => {
                  state.forUpdate(strength);

                  return Promise.resolve(recipeExists ? [{ id: "recipe-id" }] : []);
                },
              }),
            }),
          };
        }

        return {
          from: () => ({
            where: () => Promise.resolve([{ sourceImages, maxOrder }]),
          }),
        };
      },
      insert: () => ({
        values: (values: { image: string; order: string }) => {
          state.insertValues(values);

          return {
            returning: () => Promise.resolve([{ id: "image-id", ...values, version: 1 }]),
          };
        },
      }),
    };

    return run(tx);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addGalleryImageWithinCap", () => {
  it("locks the recipe row before it counts and inserts", async () => {
    mockTransaction({ sourceImages: 9, maxOrder: "9" });

    const result = await addGalleryImageWithinCap("recipe-id", "/recipes/r/new.jpg");

    expect(state.transaction).toHaveBeenCalledTimes(1);
    expect(state.forUpdate).toHaveBeenCalledWith("update");
    expect(state.insertValues).toHaveBeenCalledWith({
      recipeId: "recipe-id",
      image: "/recipes/r/new.jpg",
      order: "10",
    });
    expect(result).toMatchObject({ status: "added", image: { order: 10 } });
  });

  it("returns cap-reached without an insert when ten Source Images exist", async () => {
    mockTransaction({ sourceImages: 10, maxOrder: "9" });

    expect(await addGalleryImageWithinCap("recipe-id", "/recipes/r/new.jpg")).toEqual({
      status: "cap-reached",
    });
    expect(state.forUpdate).toHaveBeenCalledWith("update");
    expect(state.insertValues).not.toHaveBeenCalled();
  });

  it("returns recipe-missing without a count or an insert", async () => {
    mockTransaction({ recipeExists: false });

    expect(await addGalleryImageWithinCap("recipe-id", "/recipes/r/new.jpg")).toEqual({
      status: "recipe-missing",
    });
    expect(state.insertValues).not.toHaveBeenCalled();
  });
});
