# 03: Every other Device Preference moves to the profile; the cookies go

**What to build:** These Device Preferences move to the reader's profile per Device Kind, on the mechanism 01 and 02 proved, and every one of them now holds for good:

- fractions or decimals
- Hidden Items
- the recipe page colour
- Today's meals
- grid or list

A cookbook opens in the reader's layout from the server's first frame. A shared recipe shows a signed-in reader their own choices and a signed-out reader the defaults. Settings says which kind its choices apply to. No preference cookie is left. See `.scratch/device-preferences/spec.md`.

**Blocked by:** 01, 02

**Status:** done

- [x] The five preferences join the shared Device Preference schema and are read and written through the App Shell provider. Their per-preference hooks keep their shape, so consumers don't change. The inline switches write to the profile just like settings: grid or list, the fractions or decimals switch on the recipe page and in cooking mode, and the mobile ingredients menu.
- [x] Hidden Items keep carrying entries the control doesn't show (a gated-off timer entry, an entry from a newer version) when the list is written back.
- [x] The cookbook page gets grid or list from the server, and nothing reads it only in the browser.
- [x] On the share page:
  - [x] a signed-in reader gets their own Device Preferences;
  - [x] a signed-out reader gets the defaults;
  - [x] the fractions or decimals switch works for a signed-out visit and is not remembered.
- [x] The settings preferences card writes the kind you're on and says which in one line ("These apply to phones" or "These apply to desktops"). Every locale is translated and `pnpm i18n:check` passes.
- [x] Every preference cookie is removed, along with its definition, its server read, its client write and its unit tests. The language cookie used before sign-in stays.
- [x] The preference-provider unit tests are rewritten against the new provider, and the preferences card tests are updated.
- [x] The first-paint browser tests seed through the API and cover Hidden Items, fractions or decimals and the page colour, each as an iPhone and as a desktop. The offline browser test that used the page-colour cookie now uses the profile.
- [x] The Hidden Items and recipe page docs say "per phone or desktop, on your profile". The share-link sentence becomes "only Ingredient icons you hid stay hidden on a shared recipe you open while signed in". Any docs screenshot of the preferences card is retaken.
- [x] The 0.25.0-beta release notes gain a Fixes and Improvements bullet: display choices are no longer forgotten after a week on an iPhone, and the installed app and the browser agree.
