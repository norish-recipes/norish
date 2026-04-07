import type { Queue, QueueOptions } from "bullmq";
import { Queue as BullQueue } from "bullmq";

import { withJobOperationContext } from "./queue-operation-context";

type QueueData<TQueue extends Queue<any, any, any>> = Parameters<TQueue["add"]>[1];
type QueueName<TQueue extends Queue<any, any, any>> = Parameters<TQueue["add"]>[0];
type QueueAddOptions<TQueue extends Queue<any, any, any>> = Parameters<TQueue["add"]>[2];

type QueueBulkJob<TQueue extends Queue<any, any, any>> = {
  name: QueueName<TQueue>;
  data: QueueData<TQueue>;
  opts?: QueueAddOptions<TQueue>;
};

function bindQueueMethod<TValue>(target: object, value: TValue): TValue {
  if (typeof value !== "function") {
    return value;
  }

  return value.bind(target) as TValue;
}

function addWithOperationContext<TQueue extends Queue<any, any, any>>(
  target: TQueue,
  jobName: QueueName<TQueue>,
  data: QueueData<TQueue>,
  jobOptions?: QueueAddOptions<TQueue>
) {
  return target.add(jobName, withJobOperationContext(data) as QueueData<TQueue>, jobOptions);
}

function addBulkWithOperationContext<TQueue extends Queue<any, any, any>>(
  target: TQueue,
  jobs: QueueBulkJob<TQueue>[]
) {
  return target.addBulk(
    jobs.map((job) => ({
      ...job,
      data: withJobOperationContext(job.data) as QueueData<TQueue>,
    }))
  );
}

export function createOperationAwareQueue<
  DataType extends object,
  DefaultResultType = any,
  DefaultNameType extends string = string,
>(name: string, opts?: QueueOptions): Queue<DataType, DefaultResultType, DefaultNameType> {
  const queue = new BullQueue<DataType, DefaultResultType, DefaultNameType>(name, opts);

  return new Proxy(queue, {
    get(target, prop, receiver) {
      if (prop === "add") {
        return (
          jobName: QueueName<typeof target>,
          data: QueueData<typeof target>,
          jobOptions?: QueueAddOptions<typeof target>
        ) => addWithOperationContext(target, jobName, data, jobOptions);
      }

      if (prop === "addBulk") {
        return (jobs: QueueBulkJob<typeof target>[]) => addBulkWithOperationContext(target, jobs);
      }

      return bindQueueMethod(target, Reflect.get(target, prop, receiver));
    },
  });
}
