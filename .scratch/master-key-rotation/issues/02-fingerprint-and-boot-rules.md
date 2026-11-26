# 02: Fingerprint, generated key and boot rules

**What to build:** `MASTER_KEY` becomes optional. Boot picks the key by the database fingerprint, generates one only on a first boot, and refuses a wrong or missing key. See the spec, "Which key is used at boot" (all rows except the re-key).

**Blocked by:** 01

**Status:** done

- [x] **Key file:** `<UPLOADS_DIR>/.norish/master-key.json`, mode `0600`, `{ "current": "<base64>", "previous"?: "<base64>" }`; generated with `crypto.randomBytes(32)`.
- [x] **Fingerprint:** derived from the key with its own HKDF label, stored plaintext through the server-config repository.
- [x] **Boot rules:** adopt `MASTER_KEY`, generate on an empty instance, refuse with a named-key message otherwise. A previous-key match is left to ticket 03 (refuse until then).
- [x] **Initialised at boot:** `crypto.ts` and Better Auth's `secret` no longer read the key at import time; the server resolves the key after the database is reachable and before anything encrypts. Build-time placeholder (`SKIP_ENV_VALIDATION`) still works.
- [x] **`safeDecrypt` throws:** it becomes `decrypt`; callers in `packages/auth/src/auth.ts` updated.
- [x] **Tests:** each boot-rule row, file mode `0600`, a mismatched `MASTER_KEY` refuses, the existing test suites still run on env mode.

## Comments

- The derived keys live on `globalThis` (`Symbol.for("norish:master-key")`), because Next bundles a second copy of the workspace packages. `resolveMasterKey()` (`@norish/shared-server/master-key`) runs right after `runMigrations()` and before the ingredient-icons scripts. The E2E harness worker opens its known key in `connectRepositories`, and the suites open `MASTER_KEY` through `packages/config/__tests__/setup/master-key.ts`.
- Decided here: in env mode with no fingerprint, the key must decrypt the newest account email (or, with no accounts, the newest secret setting) before it gets fingerprinted, so a wrong key on an old instance refuses to start. "Users" in the table counts any encrypted value. A first boot that stopped after writing the key file reuses that file. `MASTER_KEY_PREVIOUS` is read now, but only to name the re-key refusal.
- No route can serve `<UPLOADS_DIR>/.norish`: every media route pins a subfolder plus a UUID or filename pattern, and the sweeps only touch `recipes/`, `cookbooks/`, `avatars/` and `video-temp/`. `master-key-unreachable.test.ts` pins this.
- **Unticked, question for Mike (`safeDecrypt`):** no stored value needs the fallback. Every user write has encrypted since the first commit, and `users.ts` already reads with a throwing `decrypt`. But since `19b946095` the adapter decrypts users it finds by email or joins onto an account, and the `after` hook decrypts every returned user again. With a throwing `decrypt`, password sign-in answers 500. There are two ways out: decrypt only in the adapter (then Better Auth's Valkey session cache holds plaintext email and name), or track per request which users are already decrypted. Which one?
- Booted by hand on my own containers. File mode: generate, reboot, missing key file, foreign key file, wrong `MASTER_KEY`. Env mode: first boot, an old instance with its fingerprint row deleted adopting the key, wrong `MASTER_KEY`, `MASTER_KEY` unset.

### Decision: `safeDecrypt` (gatekeeper, after a read-only trace of Better Auth 1.7.26)

Decrypt only what comes straight from Postgres or from Valkey's ciphertext. The adapter stops decrypting the user it finds by email and hands Better Auth the searched address instead; responses carry the user's fields read with the throwing `decrypt`. Rejected: decrypting in the adapter (puts plaintext email, name and image into the Valkey session cache, which holds only ciphertext today) and per-request tracking (Better Auth copies the user object, so it is guessing).

### Review (f5e13101c..bb7a20613)

Spec axis:
- **fix (bug)** 1: with `MASTER_KEY` unset and no key file, the refusal blames a key file that never existed; it must name both.
- **fix (bug)** 2: "existing data" is a truthy check on the probed value; an empty email reads as an empty instance.
- **fix (bug)** 3: `tooling/ingredient-icons` runs the full boot rules; tools only open the key and never write.
- **fix** 4: key file and folder modes are tightened and warned about on read, not only on write.
- **fix** 5: a corrupt or unreadable key file refuses with the restore-from-backup sentence.
- **fix** 6: the stricter "nothing encrypted" rule stays; spec and ADR-0044 reworded (`1bf5ad7f2`).
- **fix** 7: the unreachability test covers the share-media and ingredient-icon routes too.
- **fix (bug)** 8: a blank `MASTER_KEY` or `MASTER_KEY_PREVIOUS` counts as unset.
- **fix** 9: key generation is exclusive, so two first boots at once end on one key.

Standards axis:
- **fix** key-source branching resolved once in `resolveMasterKey`; base64/Buffer pair; one helper for opening a base64 key in tests and the E2E harness; names (`KEYS`, `g`, `open`, the probe); a test pinning the fingerprint to its schema.
- **verify** the `setupFiles` line repeated in seven vitest configs: move it to a shared preset if one exists.
- **reject** `MASTER_KEY_PREVIOUS` plumbing as speculative: the ticket asks this ticket to refuse on a previous-key match, which needs it.
- **reject** moving fingerprint and trial decryption out of `crypto.ts`: the derived keys stay private to that module.

Also in this round: an export made with an API key writes the user's name as base64 (found by the trace; same root cause).

### Fix round (decided here)

- An API key's `/get-session` still answers with the stored ciphertext: Better Auth returns it from the api-key plugin's `before` hook, so no `after` hook sees it. Server code reads only its id (`readSessionPrincipal`) or the repository (`getVerifiedSession`); the ingredient export reads only the id and stays as it is.
- Boot always ends by opening the key the stored fingerprint names, also right after adopting one, so a fingerprint another boot claimed in between refuses this boot's key. Tools call `openMasterKey()`, and a source scan in `master-key.test.ts` keeps `resolveMasterKey` to the server's boot.
- A generated key file lands with `link()`; on a volume without hard links it is created exclusively in place instead (`0f188caa1`). `writeKeyFile(keys, { replace: true })` keeps the rename for ticket 03. The previous-key refusal now reads the same in both modes.
- No shared vitest preset exists under `tooling/`, so the `setupFiles` line stays in the seven configs.

### Re-review (1bf5ad7f2..3a5f27ccc)

- **fix (bug)** Spec 1: a volume without hard links crashes the first boot with a raw `link` error. Fall back to an exclusive in-place create; an unsupported directory fsync is not fatal.
- **fix (bug)** Spec 2: a fingerprint row that exists but is empty (`null` or `""`) blocks every boot; it counts as absent.
- **fix** Spec 4: a crash between `link` and `rm` leaves a second copy of the key as a `.tmp` file; leftovers are removed once the key is opened.
- **ask** Spec 3: `/api/auth/get-session` called with an API key returns ciphertext `email`, `name` and `image`. Older than this branch; no server code reads them. Fix here or as its own issue?
- **fix** Standards: comment blocks over two lines (`auth.ts`, two test files); the key source read twice in `resolveMasterKey`; `KeySource.current`/`previous` are labels and say so; `isStoredUser` and `emailWhere.value` check types instead of casting.
- **reject** Standards: a wrapper type for the fingerprint (one hex string, the reviewer calls it minor); `writeKeyFile`'s `replace` option as speculative (the re-key rewrites the file to drop `previous`).

### Fix round 2 (3a5f27ccc..f6fc77858)

All eight findings fixed, one commit each (`bdc969fc1`..`f6fc77858`). The comment sweep covers blocks this branch added; older blocks in the touched files are left alone.

### Re-review 2 (3a5f27ccc..f6fc77858)

- **fix (bug)** 1 and 3: the in-place fallback can leave a half-written key file that blocks first boot for good, and its cleanup can remove a file another boot adopted. The fallback becomes temp file, check the key file is absent, rename: atomic, nothing to clean up in place. Two first boots at once stay exclusive only where hard links exist; the spec supports one process per database.
- **fix (bug)** 2: the folder flush warns only for "not supported" codes; a real I/O error stays fatal.
- **fix (bug)** 4: the reader and the claim share one rule for "no fingerprint", so a row holding JSON `null` cannot loop.
- **fix** 5: the test that only exercised its own mock is made real or removed.

### Fix round 3 (f6fc77858..b3de6ef9f)

All five findings fixed (`19781c5e3`..`b3de6ef9f`). The key file comes to exist only on a first boot with nothing encrypted, by linking or renaming in a written and flushed temp file; nothing removes it; `writeKeyFile(keys, { replace: true })` is the one replace path and waits for ticket 03. Exit gates 0, master key suites 3/3 clean.
