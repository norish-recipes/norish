import type { z } from "zod";

import type { TagSelectBaseSchema } from "@norish/shared/contracts/zod/tag";

export type TagDto = z.output<typeof TagSelectBaseSchema>;
