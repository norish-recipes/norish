---
sidebar_position: 5
title: Localization
description: All available languages in Norish.
---

# Localization

Norish ships with these languages:

| Flag | Language           |     Code      |
| :--: | ------------------ | :-----------: |
|  🇬🇧  | English            |     `en`      |
|  🇳🇱  | Nederlands         |     `nl`      |
|  🇩🇪  | Deutsch (Sie)      |  `de-formal`  |
|  🇩🇪  | Deutsch (Du)       | `de-informal` |
|  🇫🇷  | Français           |     `fr`      |
|  🇪🇸  | Español            |     `es`      |
|  🇷🇺  | Русский            |     `ru`      |
|  🇰🇷  | 한국어             |     `ko`      |
|  🇳🇴  | Norsk              |     `no`      |
|  🇵🇱  | Polski             |     `pl`      |
|  🇩🇰  | Dansk              |     `da`      |
|  🇮🇹  | Italiano           |     `it`      |
|  🇧🇷  | Português (Brasil) |    `pt-BR`    |
|  🇧🇬  | Български          |     `bg`      |
|  🇫🇮  | Suomi              |     `fi`      |
|  🇺🇦  | Українська         |     `uk`      |
|  🇸🇪  | Svenska            |     `sv`      |
|  🇪🇬  | العربية            |     `ar`      |

Set the default language, and limit which ones people can pick:

| Variable          | Description                             | Default       |
| ----------------- | --------------------------------------- | ------------- |
| `DEFAULT_LOCALE`  | Instance default locale                 | `en`          |
| `ENABLED_LOCALES` | Comma-separated list of enabled locales | (all enabled) |

```yaml title="docker-compose.yml (environment)"
DEFAULT_LOCALE: en
ENABLED_LOCALES: en,nl,no
```

:::tip
You can also turn languages on or off under **Settings => Admin => General**.
To add a new language, see
[Adding translations](https://github.com/norish-recipes/Norish/blob/main/CONTRIBUTING.md#adding-translations).
:::
