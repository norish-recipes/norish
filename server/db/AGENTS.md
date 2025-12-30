# DATABASE - Drizzle ORM Layer

## OVERVIEW

PostgreSQL via Drizzle ORM. Schema definitions, typed repositories, auto-generated Zod schemas.

## STRUCTURE

```
db/
├── schema/        # Drizzle table definitions
├── repositories/  # Data access layer (CRUD operations)
├── zodSchemas/    # Auto-generated Zod schemas from Drizzle
├── migrations/    # Drizzle migration files
└── drizzle.ts     # DB connection (lazy-initialized singleton)
```

## WHERE TO LOOK

| Task           | Location                                          |
| -------------- | ------------------------------------------------- |
| Add table      | `schema/<table>.ts` → export in `schema/index.ts` |
| Add relations  | `schema/relations.ts`                             |
| Add CRUD ops   | `repositories/<entity>.ts`                        |
| Zod validation | `zodSchemas/` (auto-generated, don't edit)        |

## PATTERNS

### Adding a Table

1. Create `schema/<entity>.ts`:

```typescript
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const myTable = pgTable("my_table", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

2. Export in `schema/index.ts`
3. Add relations in `schema/relations.ts` if needed
4. Run `pnpm db:push` to apply

### Repository Pattern

Repositories encapsulate all DB queries:

```typescript
// repositories/my-entity.ts
export const myEntityRepository = {
  async findById(id: string) {
    return db.query.myTable.findFirst({ where: eq(myTable.id, id) });
  },
  async create(data: NewMyEntity) {
    const [result] = await db.insert(myTable).values(data).returning();
    return result;
  },
};
```

### Key Tables

| Table                              | Purpose                          |
| ---------------------------------- | -------------------------------- |
| `recipes`                          | Recipe metadata                  |
| `ingredients`, `steps`             | Recipe components                |
| `groceries`, `recurring_groceries` | Grocery management               |
| `planned_recipe`, `notes`          | Calendar items                   |
| `households`, `household_users`    | Multi-user households            |
| `server_config`                    | Server-wide settings (encrypted) |

## ANTI-PATTERNS

- Direct `db` queries in tRPC routers (use repositories)
- Editing `zodSchemas/` manually (auto-generated)
- Missing relations in `relations.ts`
