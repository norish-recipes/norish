export const I18N_MESSAGE_SECTIONS = [
  "common",
  "recipes",
  "groceries",
  "calendar",
  "settings",
  "navbar",
  "auth",
] as const;

export async function loadLocaleMessages(locale: string): Promise<Record<string, unknown>> {
  const messages: Record<string, unknown> = {};

  for (const section of I18N_MESSAGE_SECTIONS) {
    try {
      const sectionMessages = (await import(`./messages/${locale}/${section}.json`)).default;

      messages[section] = sectionMessages;
    } catch {
      continue;
    }
  }

  return messages;
}
