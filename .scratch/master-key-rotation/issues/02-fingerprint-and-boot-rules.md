# 02: Fingerprint, generated key and boot rules

**What to build:** `MASTER_KEY` becomes optional. Boot picks the key by the database fingerprint, generates one only on a first boot, and refuses a wrong or missing key. See the spec, "Which key is used at boot" (all rows except the re-key).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] **Key file:** `<UPLOADS_DIR>/.norish/master-key.json`, mode `0600`, `{ "current": "<base64>", "previous"?: "<base64>" }`; generated with `crypto.randomBytes(32)`.
- [ ] **Fingerprint:** derived from the key with its own HKDF label, stored plaintext through the server-config repository.
- [ ] **Boot rules:** adopt `MASTER_KEY`, generate on an empty instance, refuse with a named-key message otherwise. A previous-key match is left to ticket 03 (refuse until then).
- [ ] **Initialised at boot:** `crypto.ts` and Better Auth's `secret` no longer read the key at import time; the server resolves the key after the database is reachable and before anything encrypts. Build-time placeholder (`SKIP_ENV_VALIDATION`) still works.
- [ ] **`safeDecrypt` throws:** it becomes `decrypt`; callers in `packages/auth/src/auth.ts` updated.
- [ ] **Tests:** each boot-rule row, file mode `0600`, a mismatched `MASTER_KEY` refuses, the existing test suites still run on env mode.
