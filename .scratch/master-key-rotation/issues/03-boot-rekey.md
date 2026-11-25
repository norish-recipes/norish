# 03: Re-key at boot

**What to build:** When the fingerprint matches the previous key, boot re-encrypts everything under the current key in one transaction and retires the old one. See the spec, "Re-key".

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] **Previous key:** read from `MASTER_KEY_PREVIOUS` (env mode) or the key file's `previous` (file mode).
- [ ] **One transaction:** every encrypted column in the spec's list re-encrypted, `emailHmac` and `tokenHash` recomputed, sessions and verification rows deleted, fingerprint moved. Through repositories, query builder only.
- [ ] **Legacy plaintext:** a value the previous key can't decrypt is encrypted as plaintext, counted and logged.
- [ ] **After commit:** file mode drops `previous`; env mode logs that `MASTER_KEY_PREVIOUS` can go.
- [ ] **Crash-safe:** a failure inside the transaction leaves the old fingerprint, so the next boot retries.
- [ ] **Coverage guard:** a test fails when an encrypted column exists in `packages/db-schema` that the re-key does not cover.
- [ ] **Tests:** after a re-key every value decrypts with the new key only, email sign-in and share links still resolve, all sessions are gone, API keys still work.
- [ ] **Prod copy:** run once on `~/Documents/norish_prod_copy` and report the legacy-plaintext count.
