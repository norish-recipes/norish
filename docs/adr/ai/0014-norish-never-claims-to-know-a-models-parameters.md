# Norish never claims to know which parameters a model accepts

A self-hoster configuring `claude-sonnet-5` found every AI feature dead: Anthropic answers any request carrying `temperature` with a 400 for that model, so extraction failed before the model ever read the prompt (#514). The codebase already carried a `ModelCapabilities` type — `supportsTemperature`, `supportsMaxTokens`, `supportsVision`, `supportsStructuredOutput`, `maxTemperature` — declared, re-exported through the provider, API and core layers, and **never populated and never read**. We deleted it rather than filling it in, and made the configured temperature a Generation Preference: Norish asks for it, and drops it for the life of the process on any model that refuses it.

We rejected populating the capability table, which is the obvious fix and the wrong one. A table of model ids is exactly the thing that lagged and caused the failure: the provider packages already ship one, and #514 was that table being out of date. Norish would have to maintain a second copy of it, updated on the release cadence of every provider at once — and it would still be empty where it matters most, because `@ai-sdk/openai-compatible` (Ollama, LM Studio, every generic endpoint) sits in front of whatever model the operator happens to run, which no table can enumerate. Runtime learning has no such lag: the model itself is the authority, it is asked once, and its answer is believed.

## Consequences

- There is no capability type anywhere in the codebase, and adding one back is a decision to reopen this ADR, not a gap to fill in.
- Knowledge of a refusal is process-local and deliberately unpersisted: which parameters a model accepts is a property of the upstream service, not of this install, and it changes when the provider changes it. A restart re-learns it in one request.
- A refusal costs one rejected round trip per model per process. That is the price of not guessing, and it is paid once.
- Detecting a refusal is a substring match on the provider's own error, so a false positive is possible — Norish sends recipe text that talks about oven temperature. When the retry also fails, the caller therefore receives the model's **original** objection with the retry's failure attached as its `cause`: the retry is speculative recovery, and its failure is a detail of the recovery rather than the diagnosis.
- Only request-shape rejections (400/422) are recovered. A 5xx, a timeout or a rate limit keeps its own error rather than being retried into a silently different request.
- Keeping the provider packages current remains the first line of defence, not a substitute for this: where a provider knows a model, it drops the parameter itself and no round trip is wasted.
