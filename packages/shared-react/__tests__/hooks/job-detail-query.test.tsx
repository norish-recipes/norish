/**
 * The job detail modal is one observer that moves from job to job, so a job
 * still loading has to read as loading, never as the job opened before it.
 */

import { act, useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CreateAdminHooksOptions } from "../../src/hooks/admin/types";
import { createUseJobQueue } from "../../src/hooks/admin/use-job-queue";
import { renderHookWithClient } from "./render-hook";

type Selection = { queue: string; jobId: string; enabled: boolean };

const details: Record<string, Promise<unknown>> = {
  "job-a": Promise.resolve({ id: "job-a" }),
  "job-b": new Promise(() => undefined),
};

const useTRPC = (() => ({
  admin: {
    jobs: {
      detail: {
        queryOptions: (input: { queue: string; jobId: string }) => ({
          queryKey: ["admin.jobs.detail", input],
          queryFn: () => details[input.jobId],
        }),
      },
    },
  },
})) as unknown as CreateAdminHooksOptions["useTRPC"];

const { useJobDetailQuery } = createUseJobQueue({ useTRPC });
const open = (jobId: string): Selection => ({ queue: "recipe-import", jobId, enabled: true });
const closed: Selection = { queue: "", jobId: "", enabled: false };

let unmount: (() => void) | undefined;

afterEach(() => unmount?.());

describe("useJobDetailQuery", () => {
  it("does not show the previous job while the next one loads", async () => {
    let result: ReturnType<typeof useJobDetailQuery> | undefined;
    let select: (selection: Selection) => void = () => undefined;

    ({ unmount } = renderHookWithClient(new QueryClient(), () => {
      const [selection, setSelection] = useState(open("job-a"));

      select = setSelection;
      result = useJobDetailQuery(selection);
    }));

    await vi.waitFor(() => expect(result?.job).toEqual({ id: "job-a" }));

    act(() => select(closed));
    act(() => select(open("job-b")));

    expect(result?.job).toBeNull();
    expect(result?.isLoading).toBe(true);
  });
});
