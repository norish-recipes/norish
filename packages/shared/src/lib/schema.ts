import z from "zod";

export const httpUrlSchema = z.url({
  protocol: /^https?$/,
  hostname: z.regexes.domain,
});
