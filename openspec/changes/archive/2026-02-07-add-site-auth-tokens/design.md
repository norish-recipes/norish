## Context

Users need to authenticate with external sites (Instagram, Facebook, etc.) to import recipes and videos from protected content. The system currently has no mechanism for per-user, per-domain credentials. This change spans the database layer, backend API, two fetching subsystems (Playwright and yt-dlp), the import pipeline, and the settings UI.

## Goals / Non-Goals

- Goals:
  - Allow users to store per-domain authentication tokens (headers or cookies) securely
  - Inject matching tokens into Playwright browser contexts during recipe fetching
  - Inject matching tokens into yt-dlp commands during video downloading
  - Provide a user-friendly settings UI for managing tokens
  - Full i18n support for all new UI strings
  - Comprehensive test coverage

- Non-Goals:
  - OAuth flows to automatically obtain tokens from external sites
  - Browser extension or bookmarklet for cookie extraction
  - Admin-level (server-wide) tokens shared across all users
  - Token rotation or expiry management

## Decisions

### Storage: Dedicated table vs server_config key-value store

- **Decision:** Use a dedicated `site_auth_tokens` table with per-user ownership.
- **Rationale:** The `server_config` table is for server-wide admin settings. Site auth tokens are per-user, have multiple entries per user, and contain sensitive values requiring encryption. A dedicated table with proper foreign keys, indexing, and per-row encryption is more appropriate.

### Token type model: header vs cookie

- **Decision:** Store a `type` column with values `header` or `cookie`. For headers, inject as `extraHTTPHeaders` in Playwright and `--add-header` in yt-dlp. For cookies, inject via `context.addCookies()` in Playwright and write a Netscape cookie file for yt-dlp's `--cookies` flag.
- **Rationale:** Sites use both mechanisms. Headers work for API tokens and bearer auth. Cookies work for session-based auth (Instagram, Facebook). Supporting both covers real-world use cases.

### Domain matching strategy

- **Decision:** Match tokens by checking if the URL's hostname ends with the stored domain value (suffix match). Store domain as a simple string like `instagram.com`.
- **Rationale:** Suffix matching handles subdomains (e.g., `www.instagram.com` matches `instagram.com`) without requiring users to enumerate every subdomain. Simple and predictable.

### Value encryption

- **Decision:** Encrypt token values at rest using the same encryption approach as `server_config.valueEnc` (existing pattern in the codebase).
- **Rationale:** Auth tokens are sensitive credentials. Reusing the existing encryption pattern maintains consistency and avoids introducing new cryptographic dependencies.

### Threading tokens through the import pipeline

- **Decision:** Load matching tokens in the BullMQ worker before calling fetch/download functions. Pass tokens as an optional parameter to `fetchViaPlaywright()` and yt-dlp functions.
- **Rationale:** The worker already has access to `userId` from the job data. Loading tokens at the worker level keeps the fetch functions pure (they receive tokens, not database access). The optional parameter maintains backward compatibility.

## Risks / Trade-offs

- **Security risk:** Stored credentials could be leaked if the database is compromised => Mitigated by at-rest encryption.
- **Stale tokens:** Users must manually update tokens when they expire => Acceptable for v1; token refresh is a non-goal.
- **yt-dlp cookie file:** Writing a temporary Netscape cookie file to disk for yt-dlp => Mitigated by writing to a temp file, using it, and immediately deleting it in a `finally` block.
- **Domain collision:** Multiple tokens for the same domain => Allowed; all matching tokens are injected (multiple cookies/headers per domain is valid).

## Open Questions

- None — design is straightforward given existing patterns in the codebase.
