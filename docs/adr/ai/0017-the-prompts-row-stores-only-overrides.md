# The prompts row stores only overrides

Until 0.20, seeding copied the nine shipped prompt texts into the `prompts` config row, and saving the admin form rewrote the row wholesale with `isOverridden: true`. That one flag froze all nine prompts forever: the boot sync skipped the entire row, so a release that improved a prompt never reached any deployment whose administrator had ever pressed Save — including deployments that saved without meaningfully changing anything. The UI showed the stale stored copies, the model received them, and the only way out was a manual "Restore defaults". The boot sync had a second, opposite failure hiding behind the first: for rows *without* the flag it compared two stored fields against all nine defaults — never equal — and bulldozed the row with fresh defaults on every boot, which would have destroyed any customization not protected by the flag.

The stored row now carries **only administrator overrides**: a field is present exactly when its text differs from the shipped default. Everything else — the admin form, every model request, "Restore defaults" — is a merge of that row over the shipped prompt files at read time. The definition of "is this an override" lives in one pure module (`shared-server/ai/prompts/overrides.ts`) shared by the save path and the read path:

- **Save** drops any submitted field that is blank or equal to the current shipped default. Saving an untouched form stores nothing; reverting a prompt to the default text by hand un-pins it. A save can no longer freeze anything.
- **Boot** pruned legacy rows to genuine overrides from 0.20 to 0.25, dropping any text equal to a default some earlier release shipped and the legacy `isOverridden` flag. Since 0.26 it lives in `packages/api/src/startup/upgrades/` and prunes only rows still carrying `isOverridden`, against the texts releases up to 0.25 shipped, frozen in a file there.
- **Read** merges stored overrides over `loadDefaultPrompts()`. A missing row means no overrides; the schema's required fields are gone, so a row from any era parses.

## Consequences

- A release's new prompt text reaches every deployment that did not customize that specific prompt — override semantics are per prompt, not per row. Customized prompts survive every upgrade and keep reaching the model.
- The database never holds a copy of a default, so there is no copy to go stale. The failure mode this ADR exists for is unrepresentable, not merely handled.
- An administrator who deliberately saves an *old release's* wording keeps it (the save path compares against current defaults only).
- "Restore defaults" writes an empty row instead of a defaults snapshot, so restoring tracks future releases instead of pinning today's texts.
- The end-to-end suite restarts the production server against one database: a custom prompt survives — in the form and on the wire — while the others follow the shipped defaults, and a UI save round-trip pins exactly the edited field. Reintroducing a stored defaults snapshot, or a row-level override flag, is a decision to reopen this ADR.
