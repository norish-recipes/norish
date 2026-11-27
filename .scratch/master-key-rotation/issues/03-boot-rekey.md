# 03: Re-key at boot

**What to build:** When the fingerprint matches the previous key, boot re-encrypts everything under the current key in one transaction and retires the old one. See the spec, "Re-key".

**Blocked by:** 02

**Status:** done

- [x] **Previous key:** read from `MASTER_KEY_PREVIOUS` (env mode) or the key file's `previous` (file mode).
- [x] **One transaction:** every encrypted column in the spec's list re-encrypted, `emailHmac` and `tokenHash` recomputed, sessions and verification rows deleted, fingerprint moved. Through repositories, query builder only.
- [x] **Legacy plaintext:** a value the previous key can't decrypt is encrypted as plaintext, counted and logged.
- [x] **After commit:** file mode drops `previous`; env mode logs that `MASTER_KEY_PREVIOUS` can go.
- [x] **Crash-safe:** a failure inside the transaction leaves the old fingerprint, so the next boot retries.
- [x] **Coverage guard:** a test fails when an encrypted column exists in `packages/db-schema` that the re-key does not cover.
- [x] **Tests:** after a re-key every value decrypts with the new key only, email sign-in and share links still resolve, all sessions are gone, API keys still work.
- [x] **Prod copy:** run once on `~/Documents/norish_prod_copy` and report the legacy-plaintext count.

## Comments

### Decisions before implementation (gatekeeper, from the implementer's sweep)

- **Share links without a kept token.** `recipe_shares.tokenEnc` arrived with migration `0087` on `rc/0.28.0-beta`, nullable and without a backfill, so a share made on 0.27 or earlier holds only `tokenHash`, an HMAC under the old key of a token nobody kept. It cannot be recomputed. The re-key revokes those shares (`revokedAt`) and logs how many, so the loss is visible and the owner can share again. Rejected: refusing to rotate (hostile after a leak) and leaving the old hash (looks active, never resolves). **Ask for Mike, non-blocking:** is revoking right? Ticket 04's docs say that share links made before 0.28 stop working after a rotation.
- **Session store.** Sessions and verification values live in Valkey, each session holding the user's details under the old key. They are deleted before the transaction: nothing serves until it commits, so a crash only repeats the delete.
- **Previous key already retired.** A previous key that is set while the fingerprint matches the current key, or that equals the current key, is a plain start; file mode drops `previous`, env mode logs that `MASTER_KEY_PREVIOUS` can go.
- **No fingerprint yet.** When no fingerprint exists and only the previous key opens the data (an upgrade and a rotation in one boot), boot claims the previous key's fingerprint and then re-keys.
- Covered or safe already: API keys (unkeyed SHA-256), passwords (scrypt), OAuth tokens on accounts (none written), job payloads and caches (plaintext). Better Auth's two-factor, JWT keys and OAuth-token encryption are not enabled.

### Implementation (b66df6f2c..ca6be2446)

- `masterKeyRotation(previous, current)` in `crypto.ts` reseals and hashes with closed-over derived keys. A value the previous key opens moves, one the current key opens stays as it is, anything else is legacy plaintext. Empty values and a null `emailHmac` are left alone. The re-key reads only `MASTER_KEY_COLUMNS`, 500 rows a page. The guard classifies every text/json column in `db-schema`, foreign keys aside: a new one fails until it is re-keyed or listed as plain in the test.
- Valkey: `SCAN` `active-sessions-*` deletes the tokens each list names plus the list, then `verification:*`. Better Auth has no prefix, so the instance's namespace is the Valkey database `VALKEY_URL` names. Token-less shares are revoked with `version + 1` before resealing.
- Decided here: tools (`openMasterKey`) open the previous key while a re-key is pending. A failed key file rewrite after commit stays fatal; the next boot retries the drop.
- Worth a look: a failed boot logs Drizzle's error, which carries the failing update's parameters (new-key ciphertext and a row id, never keys or plaintext). An owner can reactivate a revoked token-less share, and it stays linkless.
- Prod copy left for its own step.

### Review (f7f430884..ca6be2446): Standards (Sonnet), Spec (Opus), cross-model (Sol)

Decided, spec amended in the commit after `ca6be2446`:
- **fix (bug)** Sol 1 / Opus 4: ciphertext neither key opens was wrapped as "plaintext" and its lookup hash recomputed from the envelope. It is now left exactly as it is, hash included, and counted as unreadable per column; only a value that is not ciphertext is legacy plaintext.
- **fix (bug)** Opus 1: a share without a kept link can be reactivated into an active share nothing reaches. Reactivate needs a kept link, in the shared rule and in the procedure. This also ends reactivation of a revoked pre-0.28 share on an instance that never rotated (**part of the ask to Mike about old shares**).
- **fix (bug)** Sol 2 / Opus 2: sessions no `active-sessions-*` list names survive the Valkey delete, and one bad entry drops a whole list. Sessions are found by what they are, not by the lists.
- **fix (bug, verify)** Sol 2: `BETTER_AUTH_SECRET(S)` in the environment may override the secret derived from the Master Key; if so a rotation would not change what signs sessions.
- **fix (bug)** Sol 3: the sweep deletes any `active-sessions-*`/`verification:*` key unseen and a non-string match blocks boot. It checks type and shape first.
- **fix (bug)** Sol 4 and the implementer's note: a failed Valkey delete or a failed re-key statement logs the raw client error (session tokens; new ciphertext, hash and row id). Boot logs a sanitised error.
- **fix** Sol 5: once the fingerprint is on the current key, a key file that cannot be rewritten logs an error and boot starts; the drop is retried every boot.
- **fix** Sol 6 / Opus 3: tests: preservation of optional encrypted fields, a real API-key request after the rotation, one boot test over real Postgres and Valkey.
- **fix** Standards: Better Auth's key layout lives beside `valkeySecondaryStorage` in `packages/auth`; one paging helper; `hashToken`/`hmacIndex` share one body; names (`PAGE`, `at`, `after`, `hashAt`, `masterKeyOpens`/`openWith`, `keyNamedBy`/`keyThatFits`); labels stored beside the keys.
- **verify** Standards: typed column-to-property mapping in `resealTable`; whether `MASTER_KEY_COLUMNS` needs its export.
- **reject** Standards 7: `master-key.ts` covering file, adoption, re-key and retirement; the reviewer calls it coherent as boot key resolution.

### Fix round (041b52fe5..63bf9d706) and its re-review (Opus, Sol)

All 12 findings handled (`ea88b46f7`..`63bf9d706`); typing `resealTable`'s row needs a cast and the `MASTER_KEY_COLUMNS` export serves the coverage guard, so both stay. `BETTER_AUTH_SECRETS` did replace the derived secret; Norish now passes `secrets` itself.

Re-review dispositions:
- **fix (bug)** Sol 2 / Opus 1-2: the ciphertext check wants canonical base64, so padding-stripped or truncated ciphertext is wrapped, and plaintext that is valid base64 stays plain. Decided: the legacy-plaintext fallback applies only to `users.email`, `name` and `image`, the only columns the old tolerant read ever covered; everywhere else a value neither key opens is unreadable. The check decodes leniently. The remaining ceiling (a name of 38+ base64 characters stays as it is) is named in the log. Tests pin both halves and a plaintext email's recomputed hash.
- **fix** Opus 3: the unreadable warning says a user with an unreadable email cannot be found by it, so the address could sign up again.
- **fix (bug)** Sol 3: the fatal log carries the driver's code and the failing stage, table and constraint, not its message, which can quote a value.
- **fix** Sol 4 / Opus 4: a failure after the key file's rename is not reported as "the retired key is still there".
- **fix** Sol 5: the Valkey test spans more than one scan page.
- **reject** Sol 1 (two instances on one Valkey database lose each other's sessions): BullMQ runs unprefixed, so such instances already share their queues; not a supported setup.
- **reject** Opus 5 (the real-boot test does not go through `server/index.ts`): ticket 04's E2E rotates through the real server.
- **reject** Opus 6 (the reactivate refusal is English): it matches the other routers and clients show their own translated toast.

### Fix round 2 (63bf9d706..844b1d64d)

All five findings fixed (`14f18b759`..`1a32dac9d`), spec amended in `844b1d64d`. A failed Valkey delete now logs only its stage, because Valkey reply errors carry no code.

### Prod copy run (2026-11-26, on `844b1d64d`)

`~/Documents/norish_prod_copy` no longer exists, so the run used the other production copy, `~/Documents/norish-prod-db-26-10-17` (0.25, taken 2026-10-17): copied, started in a throwaway Postgres with a throwaway Valkey, migrations and key resolution only, no server. **Legacy plain text: 0. Unreadable: 0.** Adopt 14 ms after 381 ms of migrations; re-key 41 ms; 2 users (email, name, image moved), 5 encrypted settings moved, 1 share revoked for keeping no token, 11 Postgres sessions deleted, both API keys kept. A second boot was a plain start; afterwards the fresh key opened every value and the production key was refused.

Found by the run, fixed after it:
- **fix** the re-key's log counts only Valkey's sessions; the Postgres session and verification rows it deletes appear nowhere.
- **fix** the key file requires 32-byte keys while `MASTER_KEY` accepts shorter ones (the production key decodes to 24 bytes), so a key the instance already runs on could not be written into a key file as `previous`.

### Fix round 3 (844b1d64d..e6e96d0dd)

Both prod-copy findings fixed: `65afab557` (the log names Postgres and Valkey counts apart), `e6e96d0dd` (`MasterKeySchema` shared by `MASTER_KEY`, `MASTER_KEY_PREVIOUS` and the key file). Found while fixing: a key is read with `Buffer.from(text, "base64")`, which skips characters outside base64, and the key file is rewritten as standard base64 of the bytes, so a hand-written key with such characters can come back under 32 characters and fail its own rule on the next boot. **fix (bug):** the key file is rewritten with each key's text as it was given, never re-encoded.

### Fix round 4 and exit

`2cb4972f7`: the key file is rewritten with each key's text as given. Exit gates 0 on `2cb4972f7`; the six key-related test files 3/3 clean. Left as it is, older than this branch: a `MASTER_KEY` written as a passphrase loses its non-base64 characters when decoded, so it holds less key material than its length suggests; changing that would lock existing instances out.
