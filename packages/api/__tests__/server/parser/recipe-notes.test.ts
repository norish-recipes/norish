import { describe, expect, it } from "vitest";

import { extractRecipeNotes } from "@norish/api/parser/recipe-notes";

describe("extractRecipeNotes", () => {
  it("reads a WP Recipe Maker note without its heading", () => {
    const notes = extractRecipeNotes(`<html><body>
      <div class="wprm-recipe-notes-container">
        <h3 class="wprm-recipe-header">Notes</h3>
        <div class="wprm-recipe-notes"><span>*Use a <strong>Russet</strong> potato.</span></div>
      </div>
    </body></html>`);

    expect(notes).toBe("*Use a Russet potato.");
  });

  it("puts each WP Recipe Maker paragraph on its own line", () => {
    const notes = extractRecipeNotes(`<div class="wprm-recipe-notes">
      <span style="display: block;">Keep it cold.</span>
      <span style="display: block;">Serve within a day.</span>
    </div>`);

    expect(notes).toBe("Keep it cold.\n\nServe within a day.");
  });

  it("keeps lists and the text between them", () => {
    const notes = extractRecipeNotes(`<div class="wprm-recipe-notes"><ul>
      <li>Add more chips.</li>
      <li>Press a few on top.</li>
      </ul>
      <span><strong>Make ahead tip</strong></span><div class="wprm-spacer"></div>
      <ol>
      <li>Chill the dough for up to 3 days.</li>
      <li>Freeze for up to 3 months.</li>
      </ol></div>`);

    expect(notes).toBe(
      [
        "- Add more chips.\n- Press a few on top.",
        "Make ahead tip",
        "1. Chill the dough for up to 3 days.\n2. Freeze for up to 3 months.",
      ].join("\n\n")
    );
  });

  it("reads a Tasty Recipes note body without its heading or the nutrition after it", () => {
    const notes = extractRecipeNotes(`<div class="tasty-recipes-notes">
      <h3>Notes</h3>
      <div class="tasty-recipes-notes-body">
        <p><span><strong>Make it gluten free:</strong> Use certified oats.</span></p>
        <p><strong>Make it nut free:</strong> Skip the nuts.</p>
      </div>
    </div>
    <div class="tasty-recipes-nutrifox"><p>An estimate.</p></div>`);

    expect(notes).toBe(
      "Make it gluten free: Use certified oats.\n\nMake it nut free: Skip the nuts."
    );
  });

  it("keeps a list item's paragraph on the line of its marker", () => {
    const notes = extractRecipeNotes(`<div class="tasty-recipes-notes-body">
      <ol><li><p>Rest the dough.</p></li></ol>
    </div>`);

    expect(notes).toBe("1. Rest the dough.");
  });

  it("treats a line wrapped in the page source as one line, and <br> as a new one", () => {
    const notes = extractRecipeNotes(`<div class="tasty-recipes-notes-body">
      <p>One sentence
         wrapped in the source.<br>A second line.</p>
    </div>`);

    expect(notes).toBe("One sentence wrapped in the source.\n\nA second line.");
  });

  it("leaves scripts out of the note", () => {
    const notes = extractRecipeNotes(
      `<div class="wprm-recipe-notes"><span>Real note.</span><script>ads()</script></div>`
    );

    expect(notes).toBe("Real note.");
  });

  it("finds nothing on a page without a notes block, or with an empty one", () => {
    expect(extractRecipeNotes("<html><body><p>Notes: none</p></body></html>")).toBeUndefined();
    expect(extractRecipeNotes(`<div class="wprm-recipe-notes"> </div>`)).toBeUndefined();
  });

  it("does not guess between the notes of several recipe cards", () => {
    const notes = extractRecipeNotes(`
      <div class="wprm-recipe-notes"><span>First recipe.</span></div>
      <div class="wprm-recipe-notes"><span>Second recipe.</span></div>`);

    expect(notes).toBeUndefined();
  });
});
