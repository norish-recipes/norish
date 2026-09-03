/**
 * Admin user management DTOs.
 * All timestamps are epoch milliseconds.
 */

export interface AdminUserHouseholdDTO {
  id: string;
  name: string;
}

export interface AdminUserRowDTO {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isServerOwner: boolean;
  isServerAdmin: boolean;
  createdAt: number;
  household: AdminUserHouseholdDTO | null;
}
