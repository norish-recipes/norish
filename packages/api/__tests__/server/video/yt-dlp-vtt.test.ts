// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseVttContent } from "@norish/api/video/yt-dlp";

describe("parseVttContent", () => {
  it("reads the caption text without its tags, each line once", () => {
    const vtt = [
      "WEBVTT",
      "",
      "1",
      "00:00:00.000 --> 00:00:02.000",
      "<c.colorE5E5E5>Add the</c> <b>flour</b>",
      "",
      "00:00:02.000 --> 00:00:04.000",
      "<00:00:02.500><c>Add the</c> <b>flour</b>",
      "",
      "00:00:04.000 --> 00:00:06.000",
      "Salt &amp; pepper, 1 &lt; 2&nbsp;tbsp",
    ].join("\n");

    expect(parseVttContent(vtt)).toBe("Add the flour Salt & pepper, 1 < 2 tbsp");
  });

  it("keeps a lone < in the caption text that opens no tag", () => {
    const vtt = ["WEBVTT", "", "00:00:00.000 --> 00:00:02.000", "1 < 2 <c>cups</c>"].join("\n");

    expect(parseVttContent(vtt)).toBe("1 < 2 cups");
  });

  it("leaves no tag behind when one is nested in another", () => {
    const vtt = ["WEBVTT", "", "00:00:00.000 --> 00:00:02.000", "<<b>b>Stir<</b>/b>"].join("\n");

    expect(parseVttContent(vtt)).toBe("Stir");
  });

  it("decodes each entity once, numeric ones included", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:00.000 --> 00:00:02.000",
      "Type &amp;lt; for less than, at the caf&#233; or caf&#xE9;",
    ].join("\n");

    expect(parseVttContent(vtt)).toBe("Type &lt; for less than, at the café or café");
  });
});
