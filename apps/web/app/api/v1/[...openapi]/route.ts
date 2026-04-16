import { handleOpenApiRequest } from "@norish/trpc/server";

export const maxDuration = 300;

const handler = (req: Request) => handleOpenApiRequest(req);

export {
  handler as DELETE,
  handler as GET,
  handler as HEAD,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
