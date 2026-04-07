## Context

The mobile app currently redirects from the root route directly into tab content and has no backend-connection bootstrap step. For mobile development and self-hosted environments, backend hostname and protocol can differ per device/simulator, so hardcoding a URL is brittle. This change introduces a deterministic startup gate that collects, verifies, and persists a backend base URL before app usage.

## Goals / Non-Goals

**Goals:**

- Add a first-run connection setup screen with a HeroUI card, URL input, and connect button.
- Verify entered URLs with `GET /api/health` before saving.
- Persist the backend base URL in secure storage.
- Skip setup and route to app content when a base URL already exists.
- Provide a reusable helper for generating `/api/trpc` URL from the saved base URL.

**Non-Goals:**

- Full tRPC provider/client integration in this change.
- Authentication/session onboarding.
- Supporting multiple saved backends or environment switching UI.

## Decisions

### 1. Gate startup at the root route

Startup gating will be implemented in the root route (`src/app/index.tsx`) to keep routing changes minimal and predictable. The root route decides whether to redirect to the connect screen or tabs based on persisted base URL presence.

**Alternatives considered:**

- Global route guards in layout. Rejected to keep this change focused on first-run startup only.

### 2. Use secure storage for backend URL

The backend base URL will be stored with `expo-secure-store` using a single key. This aligns with the requirement to keep connection configuration in secure device storage.

**Alternatives considered:**

- `expo-file-system` preferences storage. Rejected because the requirement explicitly asks for secure store.

### 3. Validate connection using `/api/health`

The connect flow will call `${baseUrl}/api/health` and only persist the URL when the response is successful. This prevents saving malformed or unreachable hosts.

**Alternatives considered:**

- Save immediately without connectivity test. Rejected due to poor first-run failure UX.

### 4. Centralize URL normalization and endpoint helpers

A small networking utility module will normalize input URLs (trim whitespace, strip trailing slashes) and expose endpoint builders for `/api/health` and `/api/trpc`.

**Alternatives considered:**

- Inline string concatenation in route components. Rejected to avoid duplicated URL logic and future bugs.

## Risks / Trade-offs

- [Users enter non-HTTP(S) or malformed URLs] -> Mitigation: parse/validate URL before health request and show inline errors.
- [Health endpoint succeeds but app still cannot fully operate] -> Mitigation: use `/api/health` only as baseline connectivity and keep error handling where tRPC gets integrated.
- [Secure storage read latency causes startup flicker] -> Mitigation: keep root route in loading state until hydration completes, then redirect once.

## Migration Plan

1. Add secure storage dependency and URL storage utility.
2. Add startup routing decision in root route.
3. Add connect screen UI and health-check connect action.
4. Persist validated base URL and redirect to main tabs.
5. Rollback by removing startup redirect and secure storage reads/writes if issues are found.

## Open Questions

- None.
