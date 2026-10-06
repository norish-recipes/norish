# Ingredient Icons tool

Draws the Ingredient Icons Norish ships for the foods its catalogue is seeded
with (`packages/shared-server/src/ingredients/icon-set/`). It reads the seeded
catalogue from a Norish database and draws through that instance's AI Runtime:
its Image Generation provider and its `ingredient-icon-style` Prompt, cut out
by the same function an upload goes through. What the set looks like is what an
instance draws.

The vague groups (`src/vague-groups.ts`) are drawn no icon and listed in the
manifest as `none`, so a food under them borrows nothing vague.

## Steps

1. **Point it at a database with an image provider.** The tool reads the
   repository's `.env.local` like the dev server: `DATABASE_URL` and
   `MASTER_KEY` of an instance whose catalogue is seeded, with AI on and an
   Image Generation provider set in its admin settings.
2. **Run the sample.**

   ```sh
   pnpm --filter @norish/ingredient-icons-tool draw sample
   ```

   About twenty foods (pale ones, liquids, powders, spices, cuts of meat) at
   the low and the medium tier, on a light and a dark ground, in
   `tooling/ingredient-icons/out/sample-sheet.png`, rewritten after each food.
   The sample only draws into the sheet; nothing reaches the set or the app.

3. **Approve.** If the style is off, tune `ingredient-icon-style.txt` in
   `packages/shared-server/src/ai/prompts/` (then run
   `node tooling/monorepo/scripts/generate-retired-prompt-defaults.mjs`) and run
   the sample again. Choose the tier.
4. **Run full.** The placeholder shapes the set held before it was drawn count
   as drawn, so clear them first:

   ```sh
   rm packages/shared-server/src/ingredients/icon-set/icons/*.webp
   node -e 'const f="packages/shared-server/src/ingredients/icon-set/manifest.json",m=require("./"+f);m.icons={};require("fs").writeFileSync(f,JSON.stringify(m,null,2)+"\n")'
   ```

   Then:

   ```sh
   pnpm --filter @norish/ingredient-icons-tool draw full --tier low
   pnpm --filter @norish/ingredient-icons-tool draw full --tier low --yes
   ```

   The first says how many icons it will draw; the second draws them, one at a
   time unless `--concurrency` says more, writing each icon and the manifest as
   it lands. A refusal for the provider's rate limit is waited out. Mind the
   limit: an OpenAI account on its first usage tier draws 5 images a minute,
   which makes the full set of about 5,600 icons a run of some 19 hours; a
   higher tier draws many more. A stopped run picks up where it stopped.
   Failures are listed at the end: run again to retry them, or leave them to
   borrow their parent's. A running Norish server picks the new set up by
   itself.

   The foods this instance's recipes use most are drawn first. `--limit 50`
   draws only the first fifty, to see real icons in the app before paying for
   the rest; a later run carries on from there. If the style changes after
   that, restore `icon-set/` from git before the real run, so nothing drawn in
   the old style is kept.

5. **Commit** the icon files and `manifest.json`. The provider's originals are
   never kept.
