# MCP server

## Problem

Norish has an HTTP API at `/api/v1`, but an external AI agent cannot use it without a
client for that API. MCP clients speak one protocol: the Model Context Protocol. Norish needs
an MCP server that gives household work as tools.

The hard requirement is permission parity. An MCP caller must see and change exactly what
the same user can see and change in the app. A user with less access must never read or change a
recipe that the app does not show to them.

## Scope

In scope:

- A Streamable HTTP MCP endpoint at `/api/mcp` inside the Norish server.
- Bearer API key authentication through the Better Auth `apiKey` plugin.
- Recipe tools: search, get, create, update, delete.
- Grocery tool: list.
- Meal-plan tool: add a recipe to the caller's plan.
- Per-user rate limiting, body size limits, and audit logging.
- Unit tests.
- Operator and user documentation, plus release notes.

Out of scope:

- An MCP client inside Norish.
- Admin, server-configuration, or user-management tools.
- A new approval workflow. The self-scoped planned-meal tool is the request surface.
- New roles. Norish has no child or adult role now; the recipe permission policy is the
  only access model, and the MCP server uses it as it is.
- Recipe import tools. They fetch a caller-supplied URL, which is an SSRF surface.
- The app recipe image route. This change removes image paths from MCP input; the app route
  is not part of this change.

## Architecture

`packages/mcp` holds the MCP server, the tool handlers, authentication, and rate limiting.
`apps/web/app/api/mcp/route.ts` is the HTTP mount. The Node server already sends
every request to Next.js, so the route handler is the one mount point. No second process
is necessary.

Each POST builds a fresh `McpServer` and a fresh `WebStandardStreamableHTTPServerTransport`
in stateless mode. The transport returns JSON. A request that carries no session cannot
reuse another user's tool state. The endpoint accepts POST only. GET and DELETE have no
session to resume or close.

Every tool gets one `McpCaller`: user id, household member ids, household key, and the
server-admin flag. The values are from the same sources that `withAuth` uses:
`getUserSessionIdentity` and `getHouseholdForUser`.

## Authentication

The endpoint accepts a Better Auth API key in one of these headers:

- `x-api-key: <key>`
- `Authorization: Bearer <key>`
- `bearer: <key>` (the header name in the Better Auth plugin configuration)

The endpoint calls `verifyApiKeyForRequest` and then `getUserSessionIdentity`. A missing,
invalid, disabled, or expired key returns 401 with no data. A key over the rate limit of the key
returns 429. The endpoint does not accept a session cookie: an MCP client must hold an API
key.

## Tools and permissions

| Tool             | Action | Permission check                                                         |
| ---------------- | ------ | ------------------------------------------------------------------------ |
| `search_recipes` | View   | `listRecipes` applies the view policy in SQL                             |
| `get_recipe`     | View   | `canAccessResource("view", ...)`                                         |
| `create_recipe`  | Create | The caller is the `owner` of the new recipe                              |
| `update_recipe`  | Edit   | `canAccessResource("view", ...)` then `canAccessResource("edit", ...)`   |
| `delete_recipe`  | Delete | `canAccessResource("view", ...)` then `canAccessResource("delete", ...)` |
| `list_groceries` | View   | Query scoped to the caller and every household member                    |
| `plan_meal`      | Plan   | `canAccessResource("view", ...)`; the planned item is the caller's       |

Owner and server-admin access use the same checks as `canAccessResource`. The tool set has no
admin, configuration, or user-management surface.

## Security

- Rate limit: 120 requests per minute for each user, in memory in the one server process.
  Better Auth also limits each API key to 500 requests per hour.
- Body limit: 256 KiB. The transport returns 413 before it reads a body that is too large.
- No tool fetches a caller-supplied URL. There is no SSRF path.
- No tool reads or writes a path from input. There is no path traversal path.
- The create and update tools do not accept image paths. The Dish Colour code never sees
  a caller-supplied path.
- Errors to the caller are short. Authorization failures for a recipe the caller cannot
  view return `Recipe not found.`, so the response does not show that the recipe is there.
- Pino audit records carry the user id, tool name, outcome, and duration. They never carry
  the API key, the Authorization header, tool arguments, or recipe details.

## Tests

`packages/mcp/__tests__/http.test.ts` drives the real HTTP handler and the real permission
helper with mocked repositories. It covers:

- 401 for a missing key, an invalid key, an expired key, and a deleted user.
- Bearer header support and the 429 per-key rate limit.
- The exact seven-tool surface, with no admin tool.
- View, edit, and delete parity for `owner`, household, everyone, and no-access levels.
- Planning a visible recipe without edit rights.
- Household scoping of groceries and recipe search.
- Zod input validation.
- Per-user rate limiting and the body size limit.
- Real Better Auth API key paths through PostgreSQL: valid, disabled, and expired.
- Real repository reads that keep a recipe the user cannot see out of rows and total.
- The route import that wires the Better Auth API key service.

The unit tests need no external service. The database test in
`__tests__/integration/` needs PostgreSQL and runs when `CI=true` or `MCP_DB_TEST=1`.

## Acceptance checks

- An MCP client with a valid API key can list tools and call every tool.
- A caller without a key gets 401 and no data.
- A recipe the caller cannot view returns `Recipe not found.` from every recipe tool.
- A caller who can view but not edit can plan the recipe and cannot update or delete it.
- `pnpm --filter @norish/mcp run test`, `typecheck`, and `lint` pass.
