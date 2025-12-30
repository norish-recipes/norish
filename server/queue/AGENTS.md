# QUEUE - BullMQ Workers

## OVERVIEW

Background job processing via BullMQ + Redis. Each job type has queue + worker.

## STRUCTURE

```
queue/
├── recipe-import/      # Import recipes from URLs
├── image-import/       # Import recipes from images (AI)
├── paste-import/       # Import recipes from pasted text
├── nutrition-estimation/ # Estimate nutrition info (AI)
├── caldav-sync/        # Sync with CalDAV calendars
├── scheduled-tasks/    # Cleanup, recurring jobs
└── start-workers.ts    # Worker orchestration
```

## WHERE TO LOOK

| Task               | Location                              |
| ------------------ | ------------------------------------- |
| Add job type       | Create `<job>/queue.ts` + `worker.ts` |
| Modify worker      | `<job>/worker.ts`                     |
| Add scheduled task | `scheduled-tasks/`                    |

## PATTERNS

### Job Structure

Each job folder contains:

- `queue.ts` - Queue definition + job add functions
- `worker.ts` - Worker with `start*Worker()` + `stop*Worker()`

```typescript
// queue.ts
export const myQueue = new Queue("my-queue", { connection });

export async function addMyJob(data: MyJobData) {
  return myQueue.add("process", data);
}

// worker.ts
let worker: Worker | null = null;

export function startMyWorker() {
  worker = new Worker(
    "my-queue",
    async (job) => {
      // Process job
    },
    { connection }
  );
}

export async function stopMyWorker() {
  await worker?.close();
}
```

### Registering Workers

Add to `start-workers.ts`:

```typescript
import { startMyWorker, stopMyWorker } from "./my-job/worker";

// In startWorkers()
startMyWorker();
log.info("My worker started");

// In stopWorkers()
await stopMyWorker();
```

### Job Flow (Recipe Import Example)

1. Client calls `trpc.recipes.import({ url })`
2. Router adds job via `addRecipeImportJob()`
3. Worker processes: fetch → parse → save
4. Worker emits event via typed emitter
5. Client subscription receives update

## EXISTING WORKERS

| Worker                 | Trigger        | Purpose                  |
| ---------------------- | -------------- | ------------------------ |
| `recipe-import`        | URL import     | Scrape + parse recipes   |
| `image-import`         | Image upload   | AI recipe extraction     |
| `paste-import`         | Text paste     | Parse pasted recipe text |
| `nutrition-estimation` | Manual trigger | AI nutrition calculation |
| `caldav-sync`          | Config change  | Sync with CalDAV server  |
| `scheduled-tasks`      | Cron-like      | Cleanup old data         |

## ANTI-PATTERNS

- Blocking main thread (use workers)
- Missing worker start/stop exports
- Forgetting to emit events after job completion
