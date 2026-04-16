export interface UserPreferences {
  timersEnabled?: boolean;
  showConversionButton?: boolean;
  showRatings?: boolean;
  showFavorites?: boolean;
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
