# Recipe Equipment (Utensils)

Spec for recipe equipment, kitchen utensils, catalogue management, and recipe page integration.

## Problem

Home cooks need to know what tools and equipment (e.g. springform pan, blender, wok, rolling pin) a recipe requires before starting. Without a structured equipment concept:
- Equipment gets written haphazardly in ingredients or lost in instruction text.
- Recipe cards lack a quick-glance checklist of required utensils.
- Users cannot manage a shared catalogue of kitchen tools or customize tool icons.

## Goals

1. **Equipment Catalogue**: Provide an equipment management tab under **Settings** (`/settings/equipment`) modeled on the ingredients catalogue (name, multilingual aliases, custom icon upload, delete, merge).
2. **Built-in Defaults**: Ship 22 standard kitchen tools with transparent WebP icons and translations across 16 locales.
3. **Recipe Integration**:
   - In the recipe editor, an **Equipment** input section allows entering utensils line-by-line with smart autocomplete matching the catalogue.
   - On the recipe view and shared recipe pages, a dedicated read-only **Equipment** card lists required utensils with icons.
4. **Idempotent Storage & Migrations**: Schema migrations with `CREATE TABLE IF NOT EXISTS`, safe indexes, and automated boot-time seeding.

