# Translation Guide

This guide explains how to contribute translations to Norish.

## Structure

Translation files are organized by locale in the `messages/` directory:

```
messages/
├── en/                 # English (default)
│   ├── common.json     # Shared UI elements (buttons, labels, errors)
│   ├── navbar.json     # Navigation and user menu
│   ├── auth.json       # Login, signup, authentication
│   ├── recipes.json    # Recipe pages and forms
│   ├── groceries.json  # Grocery list features
│   ├── calendar.json   # Calendar and meal planning
│   ├── settings.json   # User settings
│   └── admin.json      # Admin settings
└── README.md           # This file
```

## Adding a New Language

1. **Create the locale folder**:

   ```bash
   mkdir messages/fr  # For French, for example
   ```

2. **Copy English files as a template**:

   ```bash
   cp messages/en/*.json messages/fr/
   ```

3. **Update `i18n/config.ts`**:

   ```typescript
   // Add to locales array
   export const locales = ["en", "fr"] as const;

   // Add country code for flag
   export const localeToCountry: Record<Locale, string> = {
     en: "GB",
     fr: "FR",
   };

   // Add display name
   export const localeNames: Record<Locale, string> = {
     en: "English",
     fr: "Français",
   };
   ```

4. **Translate the JSON files**:
   - Keep the same structure and keys
   - Only translate the values
   - Preserve placeholders like `{count}`, `{name}`, etc.

## Translation Guidelines

### Do's

- ✅ Keep translations concise (UI space is limited)
- ✅ Preserve all placeholders (`{variable}`)
- ✅ Maintain plural forms where specified
- ✅ Use formal/informal consistently within your language
- ✅ Test your translations in the app

### Don'ts

- ❌ Don't change JSON keys
- ❌ Don't remove or add keys
- ❌ Don't translate placeholders
- ❌ Don't use machine translation without review

### Placeholders

Placeholders use the ICU message format:

```json
{
  "greeting": "Hello, {name}!",
  "items": "{count, plural, one {# item} other {# items}}"
}
```

- `{name}` - Simple variable substitution
- `{count, plural, one {# item} other {# items}}` - Pluralization

### Namespace Organization

| File             | Contains                                                  |
| ---------------- | --------------------------------------------------------- |
| `common.json`    | Buttons, labels, errors, status messages, time formatting |
| `navbar.json`    | Navigation items, user menu, search                       |
| `auth.json`      | Login, signup, password forms, OAuth, errors              |
| `recipes.json`   | Recipe cards, detail pages, forms, import, filters        |
| `groceries.json` | Grocery list, items, categories, stores, recurring        |
| `calendar.json`  | Calendar views, meals, planning, CalDAV                   |
| `settings.json`  | User settings, household, allergies, notifications        |
| `admin.json`     | Server admin, auth providers, AI config, system           |

## Usage in Components

### Client Components

```tsx
"use client";

import { useTranslations } from "next-intl";

export function MyComponent() {
  const t = useTranslations("common");

  return <button>{t("buttons.save")}</button>;
}
```

### Server Components

```tsx
import { getTranslations } from "next-intl/server";

export async function MyServerComponent() {
  const t = await getTranslations("recipes");

  return <h1>{t("page.title")}</h1>;
}
```

### With Variables

```tsx
const t = useTranslations("common");

// Simple variable
t("greeting", { name: "John" });

// Pluralization
t("time.minutes", { count: 5 }); // "5 minutes"
```

## Testing Your Translations

1. Set your browser's language to your locale
2. Or use the language selector in the app
3. Navigate through all pages to verify translations
4. Check for overflow or truncation issues

## Submitting a Translation PR

1. Fork the repository
2. Create a branch: `git checkout -b translations/fr`
3. Add your translation files
4. Update `i18n/config.ts`
5. Test thoroughly
6. Submit a PR with title: `feat(i18n): Add French translations`

## Need Help?

- Open an issue if you find missing translation keys
- Ask in discussions for context on specific phrases
- Tag `@mikevanes` for translation review
