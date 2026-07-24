# 04 — Administrator provenance configuration

**What to build:** Give administrators complete control over whether Recipe Provenance runs, whether new imports trigger it automatically, how the inference prompt is worded, and which cuisine labels guide future results. Country validation remains a stable ISO-backed product rule rather than editable configuration.

**Blocked by:** 02 — Paste import to rendered provenance

**Status:** ready-for-agent

- [ ] Global provenance enablement and automatic inference for new imports are separate settings under the existing AI configuration and respect the global AI-provider setting.
- [ ] Manual inference remains available when provenance is enabled but automatic inference is disabled.
- [ ] The provenance prompt is editable and restorable through the existing prompt administration experience, with a safe working default when no override exists.
- [ ] Administrators can add and remove normalized cuisine vocabulary values without a database migration; changes guide future inference but never rewrite stored provenance.
- [ ] Country codes are validated against ISO 3166-1 alpha-2 in code, country names use locale-aware display, and no country vocabulary is embedded in editable configuration.
- [ ] Disabled AI, disabled provenance, and disabled automatic inference return explicit skipped outcomes and never produce false lifecycle events or provider calls.
- [ ] Only administrators can read or change provenance configuration; non-admin access follows existing configuration authorization behavior.
- [ ] Admin controls participate in the existing dirty-state and save behavior, use HeroUI v3 pending APIs, and disable only the operation currently being submitted.
- [ ] All controls, descriptions, validation messages, and outcomes are localized in every bundled locale.
- [ ] Configuration API, prompt fallback and override, admin component, authorization, and locale tests for this slice pass.
