# 08: The drawing tool and its sample sheet

**What to build:** A maintainer tool that draws Norish's shipped icon set. It reads the seeded catalogue from a configured Norish database and draws through the AI Runtime with that instance's image provider and icon Prompt, so the shipped style matches what an instance draws, and the AI boundary gets no second provider client.

- **Sample mode** draws about 20 chosen foods at low and at medium quality into one contact sheet for approval. The foods include a pale food, a liquid, a powder, a spice and a cut of meat.
- **Full mode** draws every seeded food not on the vague-groups list.

See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 05, 06

**Status:** done, pending review

- [x] A tooling workspace holds the tool and the hand-picked list of vague groups (fruit, vegetable, plant, preparation, dairy, meat and the like, about 25). The list is written into the set's manifest as "drawn none".
- [x] Each food is drawn with ticket 05's sections, and made into an icon with ticket 01's function.
- [x] Full mode:
  - [x] writes the 128px files and the manifest in the format ticket 06 reads;
  - [x] resumes after a stop, skipping foods already drawn;
  - [x] reports failures at the end without stopping;
  - [x] discards the 1024px originals.
- [x] Before a full run, it prints how many icons it will draw.
- [x] A short README in the workspace explains the steps:
  - [x] point it at a database with an image provider;
  - [x] run the sample;
  - [x] approve;
  - [x] run full;
  - [x] commit.

## Comments

2026-10-06 (implementation): `tooling/ingredient-icons` (`pnpm --filter @norish/ingredient-icons-tool draw sample|full`), reading `.env.local` like the dev server. Seeded foods are the ownerless ones with an Open Food Facts id; on the dev copy that is 5,699, 5,663 to draw once the 31 vague groups and the 5 placeholders are left out. Full mode draws four at a time (`--concurrency`) and writes each icon and the manifest as it lands, so a stop loses nothing. The vague-groups list is also written into the committed manifest now, so a Draw icons round leaves those groups out before the real set exists. The sample sheet's layout was checked with stub icons; it has not been run against a real provider (that is ticket 09).
