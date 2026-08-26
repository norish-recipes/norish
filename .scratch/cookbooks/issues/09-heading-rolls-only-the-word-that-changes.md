# 09 — The heading rolls the word that changes, not the whole heading

**What to build:** _Your library_ / _Your recipes_ / _Your cookbooks_ crossfaded the complete string, so "Your" repainted along with the noun and switching lens read as a flicker. Only the word that actually changes moves now, character by character, with the same odometer roll a serving count uses. Supersedes the crossfade in `08` of the original plan and the "animated as the chip changes" line in `spec.md`.

**Status:** ready-for-human

- [x] The roll is extracted into one primitive (`components/shared/rolling-text.tsx`) that `AnimatedNumber` also sits on, rather than a second copy of the mechanic
- [x] Slots key from the left for words and from the right for numbers, so a word's shared first letter stays still and `400 → 1000` still rolls only what changed
- [x] The row holds as many slots as the longest of the three words, so no slot is created or destroyed by a change — a slot cannot roll on the render that creates it, which left the two letters "cookbooks" has over "library" simply appearing
- [x] The three headings stay three complete translated strings (`spec.md` story 50): what is fixed and what changes is read off the strings themselves
- [x] The shared prefix and suffix stop at a whitespace boundary, so a shared run of letters inside a word never splits it
- [x] A language whose three headings share nothing rolls the whole heading rather than breaking
- [x] Reduced motion still gets the plain heading
- [x] The heading's DOM text stays exactly the heading, so a reader and an assertion both see one string
- [x] Unit test over the prefix/suffix seam, including the no-shared-affix and nothing-left-to-roll cases
