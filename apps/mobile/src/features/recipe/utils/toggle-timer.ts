import { lightImpact } from "@/lib/haptics";

import { useTimerStore } from "@norish/shared-react/recipes/timers";

/** A running timer pauses; any other starts or resumes, with a light tap. */
export function toggleTimer(id: string, running: boolean) {
  const { pauseTimer, startTimer } = useTimerStore.getState();

  if (running) {
    pauseTimer(id);

    return;
  }
  startTimer(id);
  lightImpact();
}
