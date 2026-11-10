import { uploadForm } from "@/features/recipes/lib/upload-form";
import { describe, expect, it } from "vitest";

describe("uploadForm", () => {
  it("sends each given field, numbers as text, and leaves out the missing ones", () => {
    const file = new File(["x"], "dish.jpg", { type: "image/jpeg" });
    const form = uploadForm({ image: file, recipeId: "r1", order: 0, duration: undefined });

    expect([...form.keys()]).toEqual(["image", "recipeId", "order"]);
    expect(form.get("image")).toBeInstanceOf(File);
    expect(form.get("recipeId")).toBe("r1");
    expect(form.get("order")).toBe("0");
  });
});
