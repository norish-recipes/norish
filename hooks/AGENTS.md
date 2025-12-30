# HOOKS - React Query Hooks

## OVERVIEW

React hooks organized by domain. Each domain has query, mutation, and subscription hooks.

## STRUCTURE

```
hooks/
├── recipes/         # Recipe CRUD + search
├── groceries/       # Grocery list management
├── calendar/        # Meal planning
├── households/      # Household management
├── caldav/          # CalDAV sync
├── favorites/       # Recipe favorites
├── ratings/         # Recipe ratings
├── stores/          # Grocery stores
├── admin/           # Admin settings
├── config/          # App config
├── user/            # User profile
└── [standalone]     # Utility hooks (use-in-view, use-wake-lock, etc.)
```

## WHERE TO LOOK

| Task             | Location                                |
| ---------------- | --------------------------------------- |
| Add query hook   | `<domain>/use-<domain>-query.ts`        |
| Add mutation     | `<domain>/use-<domain>-mutations.ts`    |
| Add subscription | `<domain>/use-<domain>-subscription.ts` |
| Utility hook     | Root `hooks/` directory                 |

## PATTERNS

### Domain Hook Structure

Each domain folder:

- `index.ts` - Re-exports all hooks
- `use-<domain>-query.ts` - Data fetching (React Query)
- `use-<domain>-mutations.ts` - Create/update/delete
- `use-<domain>-subscription.ts` - WebSocket real-time updates

### Query Hook Pattern

```typescript
export function useRecipesQuery(filters: RecipeFilters) {
  const { data, isLoading, error } = trpc.recipes.list.useQuery(filters);
  return { recipes: data ?? [], isLoading, error };
}
```

### Mutation + Subscription Pattern

Mutations update cache optimistically, subscriptions sync across users:

```typescript
// Mutation
const createMutation = trpc.groceries.create.useMutation({
  onSuccess: (id, input) => {
    // Update local cache immediately
    setGroceriesData((prev) => ({ ...prev, groceries: [newDto, ...prev.groceries] }));
  },
  onError: () => invalidate(),
});

// Subscription (separate hook)
trpc.groceries.onCreated.useSubscription(undefined, {
  onData: (payload) => {
    // Merge incoming data (handles other users' changes)
    setGroceriesData((prev) => mergeData(prev, payload));
  },
});
```

### Naming Convention

- `use-<domain>-query.ts` - Read operations
- `use-<domain>-mutations.ts` - Write operations
- `use-<domain>-subscription.ts` - Real-time sync

## ANTI-PATTERNS

- Direct `trpc.*` calls in components (use hooks)
- Missing subscription hooks for real-time data
- Optimistic updates without subscription fallback
