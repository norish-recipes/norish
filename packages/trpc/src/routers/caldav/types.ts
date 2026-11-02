import { z } from "zod";

import type { SaveCaldavConfigInputDto } from "@norish/shared/contracts";
import { isCertificate } from "@norish/shared-server/caldav/trusted-certificate";
import {
  DeleteCaldavConfigInputSchema as SharedDeleteCaldavConfigInputSchema,
  SaveCaldavConfigInputSchema as SharedSaveCaldavConfigInputSchema,
} from "@norish/shared/contracts/zod";

export type CaldavItemType = "recipe" | "note";
export type CaldavSyncStatus = "pending" | "synced" | "failed" | "removed";

type SaveCaldavConfigInputValue = Omit<SaveCaldavConfigInputDto, "password"> & {
  password?: string;
};

type DeleteCaldavConfigInputValue = {
  version?: number;
  deleteEvents?: boolean;
};

type DeleteCaldavConfigOutputValue = {
  version?: number;
  deleteEvents: boolean;
};

/** A PEM certificate the user chose to trust for their server. */
const TrustedCertificateSchema = z
  .string()
  .max(16_384)
  .refine(isCertificate, "Not a certificate")
  .nullable()
  .optional();

export const SaveCaldavConfigInputSchema: z.ZodType<
  SaveCaldavConfigInputValue,
  SaveCaldavConfigInputValue
> = SharedSaveCaldavConfigInputSchema.extend({
  password: z.string().optional(),
  trustedCertificate: TrustedCertificateSchema,
});

export const TestCaldavConnectionInputSchema = z.object({
  serverUrl: z.url(),
  username: z.string().min(1),
  password: z.string().min(1),
  trustedCertificate: TrustedCertificateSchema,
});

export const DeleteCaldavConfigInputSchema: z.ZodType<
  DeleteCaldavConfigOutputValue,
  DeleteCaldavConfigInputValue
> = SharedDeleteCaldavConfigInputSchema;

export const GetSyncStatusInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  statusFilter: z.enum(["pending", "synced", "failed", "removed"]).optional(),
});

export const FetchCalendarsInputSchema = z.object({
  serverUrl: z.url(),
  username: z.string().min(1),
  password: z.string().min(1),
  trustedCertificate: TrustedCertificateSchema,
});

export type SaveCaldavConfigInput = z.infer<typeof SaveCaldavConfigInputSchema>;
export type TestCaldavConnectionInput = z.infer<typeof TestCaldavConnectionInputSchema>;
export type DeleteCaldavConfigInput = z.infer<typeof DeleteCaldavConfigInputSchema>;
export type GetSyncStatusInput = z.infer<typeof GetSyncStatusInputSchema>;
export type FetchCalendarsInput = z.infer<typeof FetchCalendarsInputSchema>;
