export type TimerStatus = "running" | "paused" | "completed";

export type Timer = {
  id: string;
  recipeId: string;
  recipeName?: string;
  label: string;
  originalDurationMs: number;
  remainingMs: number;
  status: TimerStatus;
  lastTickAt: number | null;
};
