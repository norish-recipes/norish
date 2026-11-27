import { z } from "zod";

const MAX_NAME_LENGTH = 200;
const MAX_UNIT_LENGTH = 40;

/** The most lines one send carries; a client sends the first of a longer list. */
export const MAX_BRING_ITEMS = 150;

/**
 * One line sent to Bring!: the amount is already scaled to the servings sent. One odd line must not
 * fail the whole send, so a name or unit that is too long is cut to its cap, not refused; a name
 * that is empty after trimming is for the sender to drop and for the server to ignore.
 */
export const BringItemSchema = z.object({
  name: z.string().transform((value) => value.trim().slice(0, MAX_NAME_LENGTH)),
  /** Any finite number; the line leaves out an amount that is not above zero at two decimals. */
  amount: z.number().nullable().optional(),
  unit: z
    .string()
    .transform((value) => value.trim().slice(0, MAX_UNIT_LENGTH))
    .nullable()
    .optional(),
});

/** A scheme a deeplink may have: Bring!'s own is https, a test double may answer http. */
const deeplinkSchema = z.url({ protocol: /^https?$/ });

/** What a handoff shows: the recipe or a title, the servings, and the lines picked. */
export const BringListSchema = z.object({
  /** The server resolves the recipe name after checking the reader may view it. */
  recipeId: z.uuid().optional(),
  /** Used when there is no recipeId. */
  title: z.string().trim().min(1).max(120).optional(),
  servings: z.number().positive().max(999).optional(),
  items: z.array(BringItemSchema).min(1).max(MAX_BRING_ITEMS),
});

/** A Bring Handoff's token, as `prepare` returned it. */
const handoffTokenSchema = z.string().regex(/^[\w-]{32}$/);

export const UpdateBringHandoffInputSchema = BringListSchema.extend({
  token: handoffTokenSchema,
});

export const DiscardBringHandoffInputSchema = z.object({ token: handoffTokenSchema });

export const BRING_FAILURE_REASONS = [
  "not-bring",
  "not-public",
  "bring-unreachable",
  "bring-rejected",
  "rate-limited",
  /** Bring!'s servers could not fetch the handoff page; `status` is what this server answered them. */
  "page-unreachable",
] as const;

export const BringFailureReasonSchema = z.enum(BRING_FAILURE_REASONS);

/** A prepared handoff: the token that changes it, and the deeplink that imports it. */
export const PrepareBringHandoffResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), token: handoffTokenSchema, deeplink: deeplinkSchema }),
  z.object({
    ok: z.literal(false),
    reason: BringFailureReasonSchema,
    status: z.number().int().optional(),
  }),
]);

export type BringItem = z.infer<typeof BringItemSchema>;
export type BringList = z.infer<typeof BringListSchema>;
export type UpdateBringHandoffInput = z.infer<typeof UpdateBringHandoffInputSchema>;
export type BringFailureReason = z.infer<typeof BringFailureReasonSchema>;
export type PrepareBringHandoffResult = z.infer<typeof PrepareBringHandoffResultSchema>;
