import { registerQueueApiHandlers } from "@norish/queue/api-handlers";

/** The parser, AI and CalDAV stacks behind these load with the first job that uses one. */
export function registerApiHandlersForQueue(): void {
  registerQueueApiHandlers(async () => (await import("./queue-api-handlers")).queueApiHandlers);
}
