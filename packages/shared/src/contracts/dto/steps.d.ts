import type { z } from "zod";

import type {
  StepInsertBaseSchema,
  StepSelectBaseSchema,
  StepSelectWithoutId,
  StepUpdateBaseSchema,
} from "@norish/shared/contracts/zod/steps";

export type StepDto = z.output<typeof StepSelectBaseSchema>;
export type StepInsertDto = z.input<typeof StepInsertBaseSchema>;
export type UpdateStepDto = z.input<typeof StepUpdateBaseSchema>;

export type StepWithoutIdDto = z.infer<typeof StepSelectWithoutId>;
