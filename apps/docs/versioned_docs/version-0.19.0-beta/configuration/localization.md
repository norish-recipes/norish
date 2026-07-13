---
sidebar_position: 5
title: Localization
description: Set the default locale and which languages are available in Norish.
---

# Localization

Norish ships with translations for these languages:

| Flag | Language      |     Code      |
| :--: | ------------- | :-----------: |
|  🇬🇧  | English       |     `en`      |
|  🇳🇱  | Nederlands    |     `nl`      |
|  🇩🇪  | Deutsch (Sie) |  `de-formal`  |
|  🇩🇪  | Deutsch (Du)  | `de-informal` |
|  🇫🇷  | Français      |     `fr`      |
|  🇪🇸  | Español       |     `es`      |
|  🇷🇺  | Русский       |     `ru`      |
|  🇰🇷  | 한국어        |     `ko`      |
|  🇳🇴  | Norsk         |     `no`      |
|  🇵🇱  | Polski        |     `pl`      |
|  🇩🇰  | Dansk         |     `da`      |
|  🇮🇹  | Italiano      |     `it`      |

You can set the instance default and restrict which locales are available:

| Variable          | Description                             | Default       |
| ----------------- | --------------------------------------- | ------------- |
| `DEFAULT_LOCALE`  | Instance default locale                 | `en`          |
| `ENABLED_LOCALES` | Comma-separated list of enabled locales | (all enabled) |

```yaml title="docker-compose.yml (environment)"
DEFAULT_LOCALE: en
ENABLED_LOCALES: en,nl,no
```

:::tip
Locales can also be enabled or disabled at runtime in
**Settings → Admin → General**. To add a brand-new language, see
[Adding translations](../development/contributing.md#adding-translations).
:::
