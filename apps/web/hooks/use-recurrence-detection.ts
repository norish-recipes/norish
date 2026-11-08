import { useRecurrenceConfigQuery } from "@norish/shared-react/config";
import { createUseRecurrenceDetection } from "@norish/shared-react/hooks";

export const useRecurrenceDetection = createUseRecurrenceDetection({
  useRecurrenceConfigQuery,
});
