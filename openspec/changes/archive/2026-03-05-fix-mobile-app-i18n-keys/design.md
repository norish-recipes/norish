## Context

The mobile app currently consumes translations from `packages/i18n`, but key usage in `apps/mobile` has drifted from canonical key definitions. Some screens reference missing or semantically incorrect keys, and some language bundles are incomplete for strings rendered in mobile flows.

This work touches multiple modules (mobile UI and shared i18n resources), so the implementation needs a predictable reconciliation workflow to avoid introducing duplicate keys or inconsistent copy.

## Goals / Non-Goals

**Goals:**

- Align mobile UI translation key usage to canonical keys defined in `packages/i18n`.
- Ensure mobile-used strings are present for every supported language.
- Prefer reuse of existing semantically equivalent keys before introducing new keys.
- Add a validation pass that can detect unresolved keys and missing locale entries for mobile-used namespaces.

**Non-Goals:**

- Rewriting localization architecture or replacing the i18n library.
- Full copy rewrite for all products beyond mobile scope.
- Introducing runtime machine translation or fallback generation.

## Decisions

1. Key-by-key reconciliation in mobile code
   - Decision: Audit each mobile-facing string reference and map it to an existing key in `packages/i18n` when equivalent meaning exists.
   - Rationale: Minimizes key proliferation and keeps translation memory stable.
   - Alternative considered: Add new keys for every mismatched usage. Rejected because it duplicates intent and increases translation maintenance.

2. Add new keys only when no equivalent exists
   - Decision: Create new keys only after confirming no existing key expresses the same message and context.
   - Rationale: Balances correctness (context-specific strings) with reuse discipline.
   - Alternative considered: Force reuse even for near matches. Rejected because it can produce awkward or inaccurate copy.

3. Locale completeness driven by mobile usage
   - Decision: For every key used by mobile, ensure all supported locales in `packages/i18n` include a translation value.
   - Rationale: Prevents partial localization and mixed-language UI.
   - Alternative considered: Depend on default-locale fallback. Rejected because fallback still degrades non-default UX.

4. Introduce verification checks
   - Decision: Run or add checks that validate key existence and locale completeness for mobile-used namespaces.
   - Rationale: Prevents regressions after this cleanup.
   - Alternative considered: One-time manual QA only. Rejected due to high regression risk.

## Risks / Trade-offs

- [Risk] Semantic mismatch when reusing similar existing keys -> Mitigation: Require context review (screen intent + tone) before remapping each key.
- [Risk] Large change surface across screens/locales -> Mitigation: Apply changes in focused batches and run translation validation after each batch.
- [Risk] Missing translations discovered late in QA -> Mitigation: Validate locale completeness in CI or pre-merge checks.
- [Trade-off] Reuse-first policy may constrain copy specificity -> Mitigation: Allow explicit new-key exceptions when semantics differ.

## Migration Plan

1. Inventory mobile translation references and map each to canonical or new keys.
2. Update mobile code references in small, reviewable batches.
3. Backfill missing locale values in `packages/i18n` for all affected keys.
4. Run validation/test checks and fix unresolved keys or missing entries.
5. Rollback strategy: revert the specific batch introducing regressions; key/value changes are source-controlled and safe to roll back.

## Open Questions

- Which locales are currently considered in-scope for mobile release quality gates?
- Do we already have a single command that validates both key existence and locale completeness, or should this change define one?
