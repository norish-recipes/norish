# 09 — Migrate Prompt editability scenarios

**What to build:** Move administrator Prompt editability coverage onto the consolidated AI fixture, preserving proof that stored Prompt changes reach the correct model request and do not leak into another request shape.

**Blocked by:** 04 — Establish the isolated AI project

**Status:** ready-for-agent

- [ ] An edited auto-categorization Prompt reaches the external-model adapter through the real AI Runtime.
- [ ] An edited allergy-detection Prompt reaches the model with the household's allergens appended.
- [ ] Image extraction uses its own Prompt and remains unaffected by an edited webpage-extraction Prompt.
- [ ] Webpage extraction continues to use the edited webpage Prompt.
- [ ] Every scenario arranges and restores its own Prompt overrides, automatic-enrichment configuration, user data, and external-model plan.
- [ ] Prompt-form browser actions remain beside Prompt test support rather than the infrastructure harness.
- [ ] Every scenario runs independently with a fresh authenticated browser page.
- [ ] Request capture proves the intended Prompt content at the true external model seam rather than inferring success only from rendered text.
- [ ] The migrated scenarios pass independently and through the consolidated `ai` project.
