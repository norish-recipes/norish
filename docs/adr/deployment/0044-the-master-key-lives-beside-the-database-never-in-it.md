# The Master Key lives beside the database, never in it

The Master Key protects against a leak of the database alone: a dump, a backup on a NAS, a compromised Postgres host. It does not protect against someone already running code in the container, who can read whatever the process reads.

**Where it lives.** An administrator may set `MASTER_KEY`, which pins it. Otherwise the instance generates one at its first start into `<UPLOADS_DIR>/.norish/master-key.json` (mode `0600`), so one backup of the database and the volume restores everything. It is never stored in Postgres, never reaches a child process's environment, and no Admin UI reveals it.

**Which key is right.** The database holds a fingerprint of the current key. Boot refuses to start when no available key matches it, and generates a key only when there is no fingerprint, no `MASTER_KEY` and no users. A lost key has no recovery mode: the way back is the backup.

**Rotation retires the old key.** Rotation runs at boot in one transaction: every encrypted value is re-encrypted, every lookup hash recomputed, every session ended, and the fingerprint moved to the new key. Sign-in signing derives from the Master Key, so every web and mobile session ends.

## Considered Options

- **Key in the database**: a dump would carry both the data and its key.
- **A less obvious path**: hides nothing from an attacker in the container, and leaves whoever restores a backup unable to tell what the file is.
- **Keeping old Better Auth secrets across a rotation** so sessions survive: the old key would still sign, which is the opposite of retiring it after a leak.
- **A reset mode for a lost key** that blanks encrypted data: the email lookup goes with the key, so password accounts could not be found again. That is a large feature for a rare disaster that a backup already covers.
- **KMS or HSM**: they stop the key being copied out, but every instance would need a cloud account or a Vault server, and Norish would stop when it is down. Out of scope until a self-hoster asks.
- **More than one Norish process per database**: not supported. A second process would keep the old key in memory after a rotation.
