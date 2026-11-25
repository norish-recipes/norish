# Master key rotation

Status: ready-for-agent

Settled in a `/grill-with-docs` session on 2026-11-25.

- **Vocabulary:** CONTEXT.md's **Master Key** (Deployment).
- **Decisions:** ADR-0044, `docs/adr/deployment/0044-the-master-key-lives-beside-the-database-never-in-it.md`.
- **Target Version:** 0.28.0-beta.
- **Tickets:** in `issues/`, in order. Ticket 01 is an independent first commit.

## Problem Statement

Every instance must be given a `MASTER_KEY` by hand, and it can never be changed: there is no way to rotate it after a leak or as routine hygiene. A wrong key does not fail. `safeDecrypt` hands back ciphertext, so names show as base64. The key, along with `DATABASE_URL`, the OAuth client secrets and `AI_API_KEY`, is in the environment of every child process Norish starts, including yt-dlp, which runs on user-supplied URLs.

## Solution

- **Optional key.** `MASTER_KEY` still pins the key. Without it, the first start generates one into `<UPLOADS_DIR>/.norish/master-key.json` (mode `0600`).
- **Fingerprint.** The database holds a fingerprint of the current key. Boot refuses a key that doesn't match and never generates over existing data.
- **Rotation.** Admin → System → "Rotate master key" (file mode), or `MASTER_KEY` + `MASTER_KEY_PREVIOUS` (env mode). Either way, the next boot re-encrypts everything in one transaction, ends every session and retires the old key.
- **Child processes** get an allowlisted environment.

## Decisions

### Threat model

- Encryption at rest guards against a database-only leak, not code running in the container. No KMS or HSM.
- The key never sits in Postgres, never reaches a child process, and no Admin UI shows it.
- One Norish process per database. Multiple replicas are not supported.

### What the Master Key yields

Today (`packages/config/src/crypto.ts`), HKDF derives three keys from it:

- **Auth secret:** Better Auth's `secret`.
- **Encryption key:** AES-256-GCM for `users.email`/`name`/`image`, the CalDAV config `*Enc` columns, `site_auth_tokens.valueEnc`, `server_config.valueEnc` and `recipe_shares.tokenEnc`.
- **HMAC key:** `users.emailHmac` and `recipe_shares.tokenHash`.

Better Auth API keys are hashed without a secret and survive a rotation.

### Which key is used at boot

A key is available from `MASTER_KEY`, `MASTER_KEY_PREVIOUS`, or the key file's `current` and `previous`. `MASTER_KEY` set means env mode, and the key file is ignored.

| Fingerprint in DB | Matches                            | Outcome                                                     |
| ----------------- | ---------------------------------- | ----------------------------------------------------------- |
| none              | `MASTER_KEY` set                   | Adopt it, write the fingerprint (every pre-change instance) |
| none              | no `MASTER_KEY`, nothing encrypted | First boot: generate the key file, write the fingerprint    |
| none              | no `MASTER_KEY`, encrypted data    | Refuse to start                                             |
| present           | current key                        | Start                                                       |
| present           | previous key                       | Re-key to the current key, then start                       |
| present           | nothing                            | Refuse to start                                             |

A refusal names which key is missing and says the only way out is restoring `MASTER_KEY` or the volume from a backup. There is no reset mode.

### Re-key

- One transaction: decrypt each encrypted value with the previous key and encrypt it with the current one; recompute `emailHmac` from the decrypted email and `tokenHash` from the decrypted share token; delete every session and verification row; write the new fingerprint.
- A value that fails to decrypt with the previous key is treated as legacy plaintext and encrypted. This is the only place that fallback exists; `safeDecrypt` becomes a throwing `decrypt`.
- After commit, file mode drops `previous` from the key file. Env mode logs that `MASTER_KEY_PREVIOUS` can be removed.
- A crash before the commit leaves the previous key matching, so the next boot retries.

### Rotation trigger

- **File mode:** the Admin action writes a fresh key as `current`, moves the old one to `previous`, and calls the existing restart (`packages/trpc/src/routers/admin/system.ts`). The confirmation says every session ends, the admin's own included.
- **Env mode:** the Admin card shows the env-pair instruction in place of the button.
- Admin settings stay web-only. Mobile only needs to land on sign-in when its session ends.

### Child processes

One helper builds every child's environment: `PATH`, `HOME`, `LANG`, `LC_*`, `TZ`, `TMPDIR`, `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` (and lower-case forms), plus what the caller names. Call sites: `embedded-parser.ts`, `media/storage.ts` (ffprobe, ffmpeg), `media/ffmpeg.ts`, `ai/runtime/wav-copy.ts`, `video/yt-dlp-version.ts`, `api/src/video/yt-dlp.ts`.

## Out of scope

- KMS, HSM, Docker secrets as a separate source.
- Recovery from a lost key.
- Multi-replica rotation.
- Rotating without a restart.
