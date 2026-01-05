# Norish v0.15.0 Release Notes

We are excited to announce the release of Norish v0.15.0! This major update introduces full internationalization support, a redesigned grocery experience, and significant improvements to our AI-powered features.

## 🚀 Major Features

### 🌍 Internationalization (i18n)

Norish now supports multiple languages! We've implemented full i18n support using `next-intl`, making the app accessible to a global audience.

### 🤖 Vercel AI SDK Migration

We've migrated our AI logic to the Vercel AI SDK. This move brings better performance, reliability, and more robust AI interactions throughout the app.

### 🛒 Grocery Page Redesign

The grocery page has been completely redesigned! It now includes a dedicated stores section, allowing you to organize your shopping more effectively.

### 🆔 OIDC Claim Mapping

For users using OIDC for authentication, Norish can now automatically assign admin roles and household memberships based on your OIDC claims or groups.

### 📁 Paprika Importer

Moving from Paprika? You can now import your entire recipe collection directly from Paprika archive files.

### ⚠️ AI-Powered Allergy Detection

Safety first! Norish now automatically detects potential allergens in your recipes using AI, providing warnings to help keep your household safe.

### 🏷️ Automatic Tagging

No more manual tagging. Our new AI-powered auto-tagging system automatically categorizes your recipes based on their content.

### 📸 Multiple Recipe Images

A single photo isn't always enough. Recipes now support multiple images, allowing you to create beautiful galleries for your culinary creations.

### 📅 Improved CalDAV Sync

We've migrated from the `caldav` package to `tsdav`, providing a much more stable and reliable experience for syncing with external calendars.

### 🏪 Groceries by Store

View and manage your groceries organized by the stores where you buy them. Shopping has never been more organized.

### 🔍 Enhanced Search

Search is now more powerful than ever with support for multiple search targets and improved filtering.

### 💾 Persistent Filters

Your search and filter preferences are now saved, so you can pick up right where you left off.

## 🐛 Bug Fixes

- **Recipe Editing**: Fixed issues when editing recipe steps and ingredient lists.
- **Performance**: Improved rate limiting and virtuoso scrolling for a smoother experience.
- **Mobile Nav**: Fixed auto-hide behavior and positioning of the mobile navigation and grocery buttons.
- **Groceries**: Fixed drag-and-drop logic and reordering for grocery items.
- **Recipe View**: Fixed reordering logic when viewing recipes.
- **UI Components**: Fixed issues with the monolith component and tag scroller.
- **Accessibility**: Fixed contrast issues and added missing translations.

## 🛠️ Technical Improvements

- Refactored AI implementation for better maintainability.
- Introduced new background queues and workers for auto-tagging and allergy detection.
- Improved Instagram video import and general video processing.
- **Stats**: 381 files changed, 40527 insertions, 5485 deletions.

## ⚠️ Upgrade Notes

### Redis is Now Required

If you haven't already, please ensure that Redis is installed and running. Redis is now a mandatory requirement for handling background tasks, recipe imports, and AI-powered features.

## ❤️ Thanks

Special thanks to all our contributors and users who provided feedback for this release!

---

_For more information, visit the [Norish Documentation](https://github.com/depiraten/norish)_
