/**
 * While their data is on its way, the Page Renderers card, the job monitor and
 * a job's detail say so, rather than showing a form switched off or no jobs.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

const renderers = vi.hoisted(() => ({ isLoading: true, stored: undefined as unknown }));
const jobQueue = vi.hoisted(() => ({
  jobs: { jobs: [] as unknown[], isLoading: true, isPlaceholderData: false },
  summaries: { summaries: [] as unknown[], isLoading: true },
  detail: { job: null as unknown, isLoading: true, error: null },
}));

vi.mock("@norish/shared-react/admin", () => ({
  useAdminConfig: () => undefined,
  usePageRenderersQuery: () => renderers,
  usePageRenderersMutation: () => ({ save: vi.fn(), isSaving: false }),
  usePageRendererTestMutation: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false }),
  useJobListQuery: () => jobQueue.jobs,
  useQueueSummaryQuery: () => jobQueue.summaries,
  useJobRetentionMutation: () => ({ updateJobRetention: vi.fn(), isUpdatingRetention: false }),
  useJobDetailQuery: () => jobQueue.detail,
  useJobQueueMutations: () => ({ isRetrying: false, isRemoving: false }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => false }),
  useFormatter: () => ({ relativeTime: () => "now", number: String }),
  useNow: () => new Date(0),
}));

const { default: PageRenderersCard } =
  await import("@/features/admin/components/page-renderers/page-renderers-card");
const { default: JobQueueCard } = await import("@/features/admin/components/jobs/job-queue-card");
const { default: JobDetailModal } =
  await import("@/features/admin/components/jobs/job-detail-modal");

beforeEach(() => {
  renderers.isLoading = true;
  renderers.stored = undefined;
  jobQueue.jobs = { jobs: [], isLoading: true, isPlaceholderData: false };
  jobQueue.summaries = { summaries: [], isLoading: true };
  jobQueue.detail = { job: null, isLoading: true, error: null };
});

describe("the Page Renderers card", () => {
  it("shows no switches until the setting has arrived", () => {
    render(<PageRenderersCard />);

    expect(screen.getByTestId("page-renderers-card")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows the form once the setting has arrived, even if none is saved", () => {
    renderers.isLoading = false;
    renderers.stored = null;

    render(<PageRenderersCard />);

    expect(screen.getAllByRole("switch").length).toBeGreaterThan(0);
  });
});

describe("the job monitor", () => {
  it("does not claim there are no jobs while they load", () => {
    render(<JobQueueCard />);

    expect(screen.getByTestId("job-table-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("empty")).not.toBeInTheDocument();
    expect(screen.queryByText(/status\.failed: 0/)).not.toBeInTheDocument();
  });

  it("says there are no jobs once it knows", () => {
    jobQueue.jobs = { jobs: [], isLoading: false, isPlaceholderData: false };
    jobQueue.summaries = { summaries: [], isLoading: false };

    render(<JobQueueCard />);

    expect(screen.queryByTestId("job-table-skeleton")).not.toBeInTheDocument();
    expect(screen.getByText("empty")).toBeInTheDocument();
  });
});

describe("the job detail modal", () => {
  it("shows a placeholder and no job actions while the job loads", () => {
    render(<JobDetailModal job={{ queue: "recipe-import", jobId: "job-1" }} onClose={vi.fn()} />);

    expect(screen.getByTestId("job-detail-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("actions.retry")).not.toBeInTheDocument();
    expect(screen.queryByText("actions.remove")).not.toBeInTheDocument();
  });
});
