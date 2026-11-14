import { describe, expect, it } from "vitest";

import { linkTarget, parseInline } from "../utils/inline-markdown";

describe("parseInline", () => {
  it("keeps plain text as one node", () => {
    expect(parseInline("Mix well")).toEqual([{ kind: "text", text: "Mix well" }]);
  });

  it("finds links, bold and italic around plain text", () => {
    expect(parseInline("Mix **well** with [salt](https://x.y) and _love_")).toEqual([
      { kind: "text", text: "Mix " },
      { kind: "bold", children: [{ kind: "text", text: "well" }] },
      { kind: "text", text: " with " },
      { kind: "link", href: "https://x.y", children: [{ kind: "text", text: "salt" }] },
      { kind: "text", text: " and " },
      { kind: "italic", children: [{ kind: "text", text: "love" }] },
    ]);
  });

  it("nests emphasis in a link label and drops images", () => {
    expect(parseInline("![pic](http://a.b/c.png)[**hot** sauce](id:abc-1)")).toEqual([
      {
        kind: "link",
        href: "id:abc-1",
        children: [
          { kind: "bold", children: [{ kind: "text", text: "hot" }] },
          { kind: "text", text: " sauce" },
        ],
      },
    ]);
  });

  it("leaves underscores inside a word alone", () => {
    expect(parseInline("use snake_case_name")).toEqual([
      { kind: "text", text: "use snake_case_name" },
    ]);
  });
});

describe("linkTarget", () => {
  it("opens the web and recipes, and nothing else", () => {
    expect(linkTarget("https://x.y/z")).toEqual({ to: "web", url: "https://x.y/z" });
    expect(linkTarget("id:abc-1")).toEqual({ to: "recipe", id: "abc-1" });
    expect(linkTarget("javascript:alert(1)")).toBeNull();
    expect(linkTarget("tel:123")).toBeNull();
  });
});
