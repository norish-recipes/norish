import type { z } from "zod";

import type { CuisineSummarySchema } from "@norish/shared/contracts/zod/cuisine";

export type CuisineSummaryDto = z.output<typeof CuisineSummarySchema>;
