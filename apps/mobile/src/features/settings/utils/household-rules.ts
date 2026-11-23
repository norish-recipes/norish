import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";

type Household = HouseholdSettingsDto | HouseholdAdminSettingsDto;

/** The page's state: no household (create or join), a member's view, or the admin's. */
export const householdState = (household: Household | null, isAdmin: boolean) =>
  !household ? "none" : isAdmin ? "admin" : "member";

/** What the page draws: a failed load with nothing held is its own state, never the forms. */
export const pageState = ({
  household,
  isLoading,
  error,
}: {
  household: Household | null;
  isLoading: boolean;
  error: unknown;
}): "household" | "loading" | "failed" | "none" =>
  household ? "household" : isLoading ? "loading" : error ? "failed" : "none";

/** Only an admin's household carries `joinCode`, so that is where the code card and Regenerate show. */
export const adminViewOf = (household: Household): HouseholdAdminSettingsDto | null =>
  "joinCode" in household ? household : null;

/** Create needs text; the mutation throws on an empty name. */
export const canCreate = (name: string) => name.trim().length > 0;
