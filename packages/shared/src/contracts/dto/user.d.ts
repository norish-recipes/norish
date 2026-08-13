export interface UserPreferences {
  hidden?: string[];
  locale?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  version: number;
  isServerAdmin?: boolean;
  preferences?: UserPreferences;
}
