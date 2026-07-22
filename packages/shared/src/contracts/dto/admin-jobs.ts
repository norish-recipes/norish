/**
 * Admin job queue monitoring DTOs.
 * All timestamps are epoch milliseconds.
 */

export type AdminJobState =
  | "waiting"
  | "active"
  | "delayed"
  | "completed"
  | "failed"
  | "paused"
  | "prioritized"
  | "unknown";

export type AdminJobStepStatus = "done" | "failed" | "running" | "skipped" | "pending";

export interface AdminJobStepDTO {
  /** Step id, possibly with a ":"-suffix (e.g. "creating-recipes:2/5") */
  id: string;
  status: AdminJobStepStatus;
  durationMs: number | null;
  /** Compact JSON summary the worker attached on completion */
  detailJson: string | null;
  /** Failure reason, set on the step the job died in */
  error: string | null;
}

export interface AdminJobRowDTO {
  queue: string;
  id: string;
  name: string;
  /** Derived from job data: url | recipeId | taskType | eventTitle */
  target: string | null;
  /** Recipe id from the job payload, when the job targets a recipe */
  recipeId: string | null;
  state: AdminJobState;
  /** Active longer than the queue's hanging threshold */
  isHanging: boolean;
  /** Current processing step reported by the worker */
  step: string | null;
  attemptsMade: number;
  maxAttempts: number;
  createdAt: number;
  processedOn: number | null;
  finishedOn: number | null;
  /** Time processing took (or has taken so far for active jobs) */
  durationMs: number | null;
  /** Truncated failure reason (full text in detail) */
  failedReason: string | null;
  /** Repeat instances of scheduled cron jobs cannot be removed */
  isRepeat: boolean;
  /** When a delayed job is scheduled to run (timestamp + delay) */
  runAt: number | null;
}

export interface AdminJobAttemptDTO {
  /** 1-based attempt number */
  attempt: number;
  /** Error message for this attempt, if it failed */
  message: string | null;
  /** Full stack trace for this attempt, if it failed */
  stack: string | null;
  /** Pipeline steps run on this attempt (+ declared-but-never-ran) */
  steps: AdminJobStepDTO[];
  /** Worker log lines recorded during this attempt */
  logs: string[];
}

export interface AdminJobDetailDTO extends AdminJobRowDTO {
  /** Pretty-printed job payload; long strings truncated */
  dataJson: string;
  returnValueJson: string | null;
  /** One entry per attempt, with its steps, logs, and (if failed) its error */
  attempts: AdminJobAttemptDTO[];
  /** Total log lines recorded (may exceed the sum shown per attempt) */
  logsTotal: number;
  /** Pretty-printed job options (attempts, backoff, removal) */
  optsJson: string;
}

export interface AdminQueueCountsDTO {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: number;
  prioritized: number;
}

export interface AdminQueueSummaryDTO {
  queue: string;
  counts: AdminQueueCountsDTO;
  hangingCount: number;
}
