# 21: Seasonings are mixed spices

**What to build:** Open Food Facts' "coating" mixes two foods. Its spellings "seasoning", "sazonador", "fűszerezés" and "シーズニング" (and any other that means seasoning, not a coating) move to the seeded **mixed spices** ("gemengde specerijen", "Gewürzmischung"), which already holds garam masala, ras el hanout and shawarma spices. "taco seasoning", "cajun seasoning" and "ranch seasoning" are then filed under mixed spices instead of coating (Mike, 2026-10-20).

- **The correction outlives the nightly fetch:** the seed is fetched from Open Food Facts every night, so a spelling move is applied as the taxonomy is read, from a short list of corrections kept with the seed. This is the first entry on that list.
- **Existing foods:** a food the words filed under coating through "seasoning" is filed under mixed spices on the first start, unless a person chose its parent.
- Coating keeps its coating spellings ("enrobage", "Überzug", "nappage", "rivestimento").

**Blocked by:** None

**Status:** done

- [x] A new "taco seasoning" is filed under mixed spices, quietly, as a parent whose spelling ends the name is.
- [x] After a nightly seed, "seasoning" is still a spelling of mixed spices, not of coating.
- [x] An existing "cajun seasoning" filed under coating is under mixed spices after the first start; one a person filed elsewhere stays.
- [x] All `CONTRIBUTING.md` gates pass.

## Comments

Measured on ticket 16's set: 18 names were filed quietly under coating, 10 of them through "seasoning". The other 8 are "… voor de coating" and "… for the coating" notes, which ticket 20 fixes.

2026-10-20, implemented:

- `SPELLING_MOVES` in `catalogue-seed.ts` is the correction list; `seedEntriesOf` applies it to every file read, so a first seed and every nightly one put the spellings on mixed spices. Moved: "seasoning", "sazonador" (es), "fűszerezés" (hu), "ochucující" (cs), "シーズニング" (ja). The other 26 coating spellings mean a coating and stay.
- An instance seeded before: the seed only adds spellings and leaves a fold another food holds, so a boot step after the first-boot seed (`correctSeedOnBoot` → `correctSeedOnce`) moves the spelling once, with the rows behind it (`moveCatalogueAlias`). It then re-files coating's own children that no person filed and whose words now say mixed spices; an unsure words-parent's open AI Change moves with it. It runs once per `SEED_CORRECTIONS_VERSION` (`correctionsVersion` in the seed state), not on every boot, so a person who moves a spelling back is not overruled. A new correction raises the version.
- Not the first-start cleanup: raising `CLEANUP_VERSION` would rerun every step, including the AI pass over every undecided food.
- Checked on the production copy's data: `en:coating` holds "seasoning" and `en:mixed-spices` exists, with garam masala, ras el hanout and shawarma spices under it. Not run end to end on the copy, which is not on this release's schema.


2026-10-20, review fixes:

- A parent a person kept from an unsure change is no longer re-filed: the re-file and `fileUndecidedMint` share one guard (`fileUnder`), which leaves a food kept distinct alone.
- A sure re-file takes an open parent change naming the old food and clears the doubt it flagged. An unsure one records the guess under the new parent.
- A moved spelling is taken from every other entry in the file, so an entry listed before mixed spices that also says "seasoning" cannot claim it.
- The boot step is its own startup module, as the others are; the outcome is a named type.
