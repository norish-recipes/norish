# 01 — Import loop carries a favourite beside the rating

**What to build:** a user importing an archive that declares a favourite mark on a recipe ends up with that recipe favourited for them, exactly the way an imported rating already lands. This is the prefactor that lets the Recipe Archive's favourite flag (ticket 05) ride the shared import loop: the loop accepts an optional favourite alongside the existing imported rating as per-recipe extras, and applies both to the winning recipe — the one overwritten on a match or freshly created — for the importing user. No existing format supplies a favourite yet, so nothing user-visible changes until the Norish parser does.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] The shared archive-import loop accepts an optional favourite mark per recipe alongside the imported rating
- [x] Both extras apply to the winning recipe (matched-and-overwritten or newly created) for the importing user
- [x] A failure to apply the favourite never fails the import, mirroring the rating's existing error posture
- [x] Behaviour of every existing archive format is unchanged
- [x] A unit test beside the existing overwrite-loop test pins the favourite's application in both the match and create paths
