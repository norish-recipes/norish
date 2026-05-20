import { createUseRecurrenceDetection } from "@norish/shared-react/hooks";

import { useRecurrenceConfigQuery } from "@/hooks/config";


export const useRecurrenceDetection = createUseRecurrenceDetection({
  useRecurrenceConfigQuery,
});
