import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@norish/auth/auth";

export const { GET, POST } = toNextJsHandler(auth.handler);
