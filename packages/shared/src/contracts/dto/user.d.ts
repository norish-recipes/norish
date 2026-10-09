import type { UserPreferencesDto } from "../zod/user";

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  version: number;
  isServerAdmin?: boolean;
  preferences?: UserPreferencesDto;
}
