import z from "zod";

export const httpUrlSchema = z.url({
  protocol: /^https?$/,
  hostname:
    /^(([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}|(\d{1,3}\.){3}\d{1,3}|localhost)$/,
});
