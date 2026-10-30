export type SettingsTab = "user" | "household" | "caldav" | "ingredients" | "admin";

/** What the server knows about the reader that decides which tabs and cards they get. */
export type SettingsShape = {
  showAdminTab: boolean;
  household: "none" | "member" | "admin";
  caldav: "none" | "disabled" | "enabled";
};

/** The tab `?tab=` opens: only an offered one, so Admin only for an admin; the user tab otherwise. */
export function openSettingsTab(
  param: string | null | undefined,
  shape: SettingsShape
): SettingsTab {
  switch (param) {
    case "household":
    case "caldav":
    case "ingredients":
      return param;
    case "admin":
      return shape.showAdminTab ? "admin" : "user";
    default:
      return "user";
  }
}
