---
sidebar_position: 1
title: API reference
description: The Norish public HTTP API under /api/v1.
---

# API reference

Norish exposes an HTTP API under `/api/v1`.

- **Visual docs**: `/api/docs`
- **OpenAPI spec (JSON)**: `/api/openapi.json`

## Authentication

Pass your API key as either header:

```http
x-api-key: <your-api-key>
```

```http
Authorization: Bearer <your-api-key>
```

Notes:

- `/api/docs` and `/api/openapi.json` require a signed-in web session.
- `GET /api/v1/health` is public and returns `200` only when the API and the
  parser service are both healthy.
- All other documented `/api/v1` endpoints require API credentials.

## Endpoints

### Health

- `GET /api/v1/health` — public health check for the API and internal parser service.

### Recipes

- `GET /api/v1/recipes/{id}`
- `POST /api/v1/recipes/search` — list recipes with optional filters.
- `POST /api/v1/recipes/import/url`
- `POST /api/v1/recipes/import/paste`

`POST /api/v1/recipes/search` returns a paginated recipe list. Optional filters
include `search`, `searchFields`, `tags`, `categories`, `filterMode`,
`sortMode`, `minRating`, and `maxCookingTime`. `cursor` defaults to `0` and
`limit` defaults to `50`.

### Groceries

- `GET /api/v1/groceries`
- `POST /api/v1/groceries`
- `PATCH /api/v1/groceries/{id}/done`
- `PATCH /api/v1/groceries/{id}/undone`
- `PATCH /api/v1/groceries/{id}/store`
- `DELETE /api/v1/groceries/{id}`

Grocery mutation endpoints that target a single grocery require a `version` field
for optimistic concurrency. `PATCH /api/v1/groceries/{id}/store` accepts
`storeId` and an optional `savePreference` in the request body.

### Stores

- `GET /api/v1/stores`
- `POST /api/v1/stores`

### Planned recipes

- `GET /api/v1/planned-recipes/today`
- `GET /api/v1/planned-recipes/week`
- `GET /api/v1/planned-recipes/month`
- `POST /api/v1/planned-recipes`
- `DELETE /api/v1/planned-recipes/{itemId}`

Planned-recipe range endpoints use the server timezone for today/week/month
boundaries. The week range is Monday through Sunday.
