---
sidebar_position: 5
title: Localização
description: Todos os idiomas disponíveis no Norish.
---

# Localização

O Norish vem com estes idiomas:

| Bandeira | Idioma             |    Código     |
| :------: | ------------------ | :-----------: |
|    🇬🇧    | English            |     `en`      |
|    🇳🇱    | Nederlands         |     `nl`      |
|    🇩🇪    | Deutsch (Sie)      |  `de-formal`  |
|    🇩🇪    | Deutsch (Du)       | `de-informal` |
|    🇫🇷    | Français           |     `fr`      |
|    🇪🇸    | Español            |     `es`      |
|    🇷🇺    | Русский            |     `ru`      |
|    🇰🇷    | 한국어             |     `ko`      |
|    🇳🇴    | Norsk              |     `no`      |
|    🇵🇱    | Polski             |     `pl`      |
|    🇩🇰    | Dansk              |     `da`      |
|    🇮🇹    | Italiano           |     `it`      |
|    🇧🇷    | Português (Brasil) |    `pt-BR`    |
|    🇧🇬    | Български          |     `bg`      |
|    🇫🇮    | Suomi              |     `fi`      |
|    🇺🇦    | Українська         |     `uk`      |

Defina o idioma padrão e limite quais as pessoas podem escolher:

| Variável          | Descrição                                           | Padrão              |
| ----------------- | --------------------------------------------------- | ------------------- |
| `DEFAULT_LOCALE`  | Idioma padrão da instância                          | `en`                |
| `ENABLED_LOCALES` | Lista de idiomas habilitados, separados por vírgula | (todos habilitados) |

```yaml title="docker-compose.yml (environment)"
DEFAULT_LOCALE: en
ENABLED_LOCALES: en,nl,no
```

:::tip
Você também pode ativar ou desativar idiomas em **Configurações => Admin => Geral**.
Para adicionar um novo idioma, veja
[Adicionando traduções](https://github.com/norish-recipes/Norish/blob/main/CONTRIBUTING.md#adding-translations).
:::
