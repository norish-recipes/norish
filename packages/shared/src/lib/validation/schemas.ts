import { z } from "zod";

/**
 * UUID validation schema
 */
export const UUIDSchema = z.uuid("Invalid UUID format");

/**
 * User ID validation schema (Better Auth uses non-UUID IDs)
 */
export const UserIdSchema = z.string().min(1, "User ID is required").max(64, "User ID too long");

/**
 * Date string in YYYY-MM-DD format
 */
export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (expected YYYY-MM-DD)");

/**
 * URL validation with max length
 */
export const UrlSchema = z.string().url("Invalid URL format").max(2048, "URL too long");

// ============================================================================
// Calendar Schemas
// ============================================================================

/**
 * Meal slot enum matching database enum
 */
export const SlotSchema = z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]);

/**
 * Calendar note title
 */
export const NoteTitleSchema = z.string().min(1, "Title is required").max(200, "Title too long");

// ============================================================================
// Household Schemas
// ============================================================================

/**
 * Household name (optional, with length constraints)
 */
export const HouseholdNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name too long")
  .optional();

/**
 * 6-digit household join code
 */
export const JoinCodeSchema = z.string().regex(/^\d{6}$/, "Join code must be 6 digits");

// ============================================================================
// CalDAV Schemas
// ============================================================================

/**
 * CalDAV username
 */
export const CaldavUsernameSchema = z
  .string()
  .min(1, "Username is required")
  .max(256, "Username too long");

/**
 * CalDAV password
 */
export const CaldavPasswordSchema = z
  .string()
  .min(1, "Password is required")
  .max(1024, "Password too long");

// ============================================================================
// Type Exports
// ============================================================================

export type Slot = z.infer<typeof SlotSchema>;
