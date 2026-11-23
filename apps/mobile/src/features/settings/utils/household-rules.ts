import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";

type Household = HouseholdSettingsDto | HouseholdAdminSettingsDto;

/** What the page draws: a cached answer (`answered`) wins over a failed refetch; only a load that
 * never succeeded fails, never showing the forms. */
export const pageState = ({
  household,
  answered,
  isLoading,
  error,
}: {
  household: Household | null;
  answered: boolean;
  isLoading: boolean;
  error: unknown;
}): "household" | "loading" | "failed" | "none" =>
  household ? "household" : answered ? "none" : isLoading ? "loading" : error ? "failed" : "none";

/** Create needs text; the mutation throws on an empty name. */
export const canCreate = (name: string) => name.trim().length > 0;
