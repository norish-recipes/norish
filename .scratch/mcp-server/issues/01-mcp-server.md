# 01 - MCP server over Streamable HTTP

Status: ready-for-human

## Goal

Let an external MCP client use Norish as the authenticated user, with the same permissions
as the app.

## Work

- [x] Add `@modelcontextprotocol/sdk` through the workspace catalog.
- [x] Add `packages/mcp` with authentication, rate limiting, the MCP server, and seven tools.
- [x] Mount the endpoint at `POST /api/mcp` in `apps/web`.
- [x] Add unit tests for authentication, permission parity, household scoping, input
      validation, the tool surface, rate limiting, and body size.
- [x] Add the MCP documentation and the release-notes entry.

## Acceptance

- Missing, invalid, and expired keys return 401.
- A recipe the caller cannot view returns `Recipe not found.`
- A caller who can view but not edit can plan and cannot update or delete.
- No admin, configuration, or user-management tool exists.
- The package tests, typecheck, and lint pass.

## Verification changes

- [x] Wire the Better Auth API key service in the MCP route.
- [x] Reject a caller-supplied recipe id, user id, or image on create and update.
- [x] Remove the no-op household check from `plan_meal`.
- [x] Move the calendar event helper to `@norish/shared-server`.
- [x] Add service-boundary, repository, proxy, and protocol start tests.
- [x] Carry the Better Auth retry time into the 429 response.
