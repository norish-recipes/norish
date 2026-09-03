# 09 — AI reads what pages do not state plainly, and searches in the store's language

**What to build:** The AI path, only for instances that have AI and only where the structured reader came up empty. Two new request shapes join the AI Runtime as Prompts: **product reading**, which reads product candidates off a rendered page that carries no structured data, and **product search term**, which turns a grocery name into what a shopper would type into this store's search box in the store's own language. Both are administrator-editable like the existing eleven, run through the one runtime (ADR-0015), and change nothing about how a lookup links: the model names a candidate, the same rules decide.

**Blocked by:** 07 — the lookup is what consults them.

**Status:** ready-for-agent

- [ ] Two shipped prompt defaults, two strict output schemas, two code-owned system messages and two prompt fields in the admin prompts form exist; the retired-defaults record is regenerated and its tests pass
- [ ] The product reading shape takes the sanitised page and the name sought and returns readings in the reader's output shape; it runs only when AI is enabled and the structured reader returned nothing, both for a lookup and for a person's paste or search
- [ ] The product search term shape takes the name, the store's declared language and host and returns the term; it runs only when the store's declared language differs from the instance's default locale, and its result replaces the normalised name as the search term for that visit
- [ ] AI failures are thrown as the runtime's typed errors and never fail the walk: a name whose AI step failed stays Unpriced and is attempted again the next day
- [ ] Feature tests mock the runtime as the enrichment features do and prove the only-after-empty and only-when-enabled rules; prompt tests cover the two defaults
