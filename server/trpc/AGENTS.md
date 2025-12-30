# TRPC - API Layer

## OVERVIEW

tRPC v11 with WebSocket subscriptions for real-time sync. HTTP + WS on same endpoint.

## STRUCTURE

```
trpc/
├── routers/           # Domain routers (groceries, recipes, etc.)
│   └── <domain>/
│       ├── index.ts        # Router export
│       ├── <domain>.ts     # Mutations/queries
│       ├── subscriptions.ts # WS subscriptions
│       ├── emitter.ts      # Typed event emitter
│       └── types.ts        # Domain types
├── router.ts          # Main app router (merges all)
├── trpc.ts            # Base router, procedures
├── middleware.ts      # Auth middleware (authedProcedure)
├── context.ts         # Request context creation
├── ws-server.ts       # WebSocket server init
└── emitter.ts         # TypedEmitter factory
```

## WHERE TO LOOK

| Task             | Location                             |
| ---------------- | ------------------------------------ |
| Add endpoint     | `routers/<domain>/<domain>.ts`       |
| Add subscription | `routers/<domain>/subscriptions.ts`  |
| Emit events      | `routers/<domain>/emitter.ts`        |
| Add new domain   | Create folder, export in `router.ts` |

## PATTERNS

### Adding a Procedure

```typescript
// routers/myDomain/myDomain.ts
export const myDomainProcedures = router({
  create: authedProcedure.input(createSchema).mutation(async ({ ctx, input }) => {
    const result = await myRepository.create(input);
    emitter.emitToHousehold(ctx.householdId, "created", result);
    return result.id;
  }),
});
```

### Real-time Pattern

1. **Mutation** updates DB, emits event via typed emitter
2. **Subscription** listens for events, sends to connected clients
3. **Client hook** receives subscription, updates React Query cache

```typescript
// emitter.ts
export const emitter = createTypedEmitter<{
  created: MyDTO;
  updated: MyDTO;
  deleted: { id: string };
}>("myDomain");

// Emit in mutation
emitter.emitToHousehold(householdId, "created", dto);

// Subscribe in subscriptions.ts
emitter.onHouseholdEvent(householdId, (event, payload) => {
  yield { type: event, data: payload };
});
```

### Middleware Chain

```
publicProcedure → authedProcedure → serverAdminProcedure
                     ↓
            permissionMiddleware (optional)
```

## EXISTING ROUTERS

| Router       | Purpose                       |
| ------------ | ----------------------------- |
| `groceries`  | Grocery list CRUD + recurring |
| `recipes`    | Recipe CRUD + import          |
| `calendar`   | Planned recipes + notes       |
| `households` | Household management          |
| `admin`      | Server config (admin only)    |
| `caldav`     | CalDAV sync config            |
| `stores`     | Grocery store management      |

## ANTI-PATTERNS

- Direct DB queries (use repositories)
- Missing emitter events after mutations
- Skipping `authedProcedure` for protected routes
