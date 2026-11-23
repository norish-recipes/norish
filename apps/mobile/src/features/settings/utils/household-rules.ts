import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";

import type { SettingsActionKind } from "./row-actions";

type Household = HouseholdSettingsDto | HouseholdAdminSettingsDto;
type JoinCode = Pick<HouseholdAdminSettingsDto, "joinCode" | "joinCodeExpiresAt">;

/** The page's state: no household (create or join), a member's view, or the admin's. */
export const householdState = (household: Household | null, isAdmin: boolean) =>
  !household ? "none" : isAdmin ? "admin" : "member";

/** What the viewer may do to a member: only an admin, never to themselves; Make admin only for a non-admin. */
export function memberActions(
  viewerIsAdmin: boolean,
  isSelf: boolean,
  memberIsAdmin: boolean
): SettingsActionKind[] {
  if (!viewerIsAdmin || isSelf) return [];

  return memberIsAdmin ? ["kick"] : ["kick", "admin"];
}

/** Only an admin's household carries `joinCode`, so that is where the code card and Regenerate show. */
export const adminViewOf = (household: Household): HouseholdAdminSettingsDto | null =>
  "joinCode" in household ? household : null;

/** The code's countdown: `none`, `expired`, or the whole minutes and seconds left. */
export function joinCodeStatus(code: JoinCode, now: number) {
  if (!code.joinCode || !code.joinCodeExpiresAt) return { kind: "none" } as const;

  const left = new Date(code.joinCodeExpiresAt).getTime() - now;

  if (left <= 0) return { kind: "expired" } as const;

  return {
    kind: "active",
    minutes: Math.floor(left / 60000),
    seconds: Math.floor((left % 60000) / 1000),
  } as const;
}

/** An admin who leaves while others remain is warned to hand admin over first, as web does. */
export const leaveWarns = (isAdmin: boolean, memberCount: number) => isAdmin && memberCount > 1;

/** Create needs text; the mutation throws on an empty name. */
export const canCreate = (name: string) => name.trim().length > 0;
