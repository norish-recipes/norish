# 08: The drawing tool and its sample sheet

**What to build:** A maintainer tool that draws Norish's shipped icon set. It reads the seeded catalogue from a configured Norish database and draws through the AI Runtime with that instance's image provider and icon Prompt, so the shipped style matches what an instance draws, and the AI boundary gets no second provider client.

- **Sample mode** draws about 20 chosen foods at low and at medium quality into one contact sheet for approval. The foods include a pale food, a liquid, a powder, a spice and a cut of meat.
- **Full mode** draws every seeded food not on the vague-groups list.

See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 05, 06

**Status:** ready-for-agent

- [ ] A tooling workspace holds the tool and the hand-picked list of vague groups (fruit, vegetable, plant, preparation, dairy, meat and the like, about 25). The list is written into the set's manifest as "drawn none".
- [ ] Each food is drawn with ticket 05's sections, and made into an icon with ticket 01's function.
- [ ] Full mode:
  - [ ] writes the 128px files and the manifest in the format ticket 06 reads;
  - [ ] resumes after a stop, skipping foods already drawn;
  - [ ] reports failures at the end without stopping;
  - [ ] discards the 1024px originals.
- [ ] Before a full run, it prints how many icons it will draw.
- [ ] A short README in the workspace explains the steps:
  - [ ] point it at a database with an image provider;
  - [ ] run the sample;
  - [ ] approve;
  - [ ] run full;
  - [ ] commit.
