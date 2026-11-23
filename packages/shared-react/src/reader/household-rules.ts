import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";
import { JoinCodeSchema } from "@norish/shared/lib/validation/schemas";

/** Create needs a name with text; the mutation throws on an empty one. */
export const isHouseholdName = (name: string) => name.trim().length > 0;

/** A join code is exactly six digits; the server strips anything else, so Join waits for these. */
export const isJoinCode = (code: string) => JoinCodeSchema.safeParse(code).success;

/** What the code field keeps of typed or pasted text: its digits, then the first six. */
export const joinCodeDigits = (value: string) => value.replace(/\D/g, "").slice(0, 6);

/** The admin's view, with the code card and Regenerate: the household must carry `joinCode` and
 * the viewer be its admin now, since a realtime handover keeps the cached code fields. */
export const adminViewOf = (
  household: HouseholdSettingsDto | HouseholdAdminSettingsDto | null,
  viewerId: string | undefined
): HouseholdAdminSettingsDto | null =>
  household &&
  "joinCode" in household &&
  household.users.some((user) => user.id === viewerId && user.isAdmin)
    ? household
    : null;

export type MemberAction = "kick" | "transferAdmin";

/** What the viewer may do to a member: only an admin, never to themselves; handing admin over
 * only to a member who is not one already. */
export function allowedMemberActions({
  viewerIsAdmin,
  isSelf,
  memberIsAdmin,
}: {
  viewerIsAdmin: boolean;
  isSelf: boolean;
  memberIsAdmin: boolean;
}): MemberAction[] {
  if (!viewerIsAdmin || isSelf) return [];

  return memberIsAdmin ? ["kick"] : ["kick", "transferAdmin"];
}

/** The code's countdown: `none`, `expired`, or the whole minutes and seconds left at `now`. */
export function joinCodeStatus(
  code: Pick<HouseholdAdminSettingsDto, "joinCode" | "joinCodeExpiresAt">,
  now: number
) {
  if (!code.joinCode || !code.joinCodeExpiresAt) return { kind: "none" } as const;

  const left = new Date(code.joinCodeExpiresAt).getTime() - now;

  if (left <= 0) return { kind: "expired" } as const;

  return {
    kind: "active",
    minutes: Math.floor(left / 60000),
    seconds: Math.floor((left % 60000) / 1000),
  } as const;
}

/** An admin who leaves while other members remain is warned to hand admin over first. */
export const leaveWarns = ({
  isAdmin,
  otherMemberCount,
}: {
  isAdmin: boolean;
  otherMemberCount: number;
}) => isAdmin && otherMemberCount > 0;
