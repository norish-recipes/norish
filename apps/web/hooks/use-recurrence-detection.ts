import { useRecurrenceConfigQuery } from "@/hooks/config";

import { createUseRecurrenceDetection } from "@norish/shared-react/hooks";

export const useRecurrenceDetection = createUseRecurrenceDetection({
  useRecurrenceConfigQuery,
});
