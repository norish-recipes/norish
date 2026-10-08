# 01: Grocery view and grouping kept per Device Kind

**What to build:** The tracer bullet. The grocery view (by store or by recipe) and grouping become the first Device Preferences kept on the reader's profile, once for phones and once for desktops. Set groceries to "by recipe" on a phone and the desktop keeps its own choice. Clear the browser's cookies, sign in again, and the phone still opens by recipe, drawn that way in the server's first frame. Everything the remaining preferences need is built here and proven on these two. See `.scratch/device-preferences/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] One shared pure function maps a user-agent string to a Device Kind: a `Mobi` token means phone, anything else means desktop. A table test covers iPhone, Android phone, Android tablet, iPad in desktop mode, Mac and Windows.
- [ ] One schema in the shared contracts declares the grocery view and grouping as Device Preferences, with their values and defaults. 03 adds the rest to the same schema.
- [ ] The profile's preferences document gains a block per Device Kind holding only the choices made on that kind. A stored value parses to a valid value or its default, and an absent value is the default.
- [ ] A new signed-in user procedure sets Device Preferences for a named Device Kind:
  - [ ] it merges per choice into that kind's block in the database, so it never rewrites the whole document;
  - [ ] the last writer wins, outside the profile's version check;
  - [ ] it rejects values outside the defined set, and it refuses signed-out requests.
- [ ] The existing language and after-planning update writes only the keys it was given. API tests prove that a language change leaves Device Preferences untouched, and that a Device Preference write leaves the language, after-planning and the other kind untouched.
- [ ] The server reads the profile once per request, and the locale lookup shares that read. The read returns this request's Device Kind block parsed to full values; a signed-out request gets the defaults.
- [ ] One provider in the App Shell holds the reader's Device Preferences for this kind, seeded by the server read. The groceries page reads and writes the view and grouping through it, with the same hooks and the same instant feel. A change updates the profile query's cache at once and sends the write.
- [ ] The two grocery preference cookies, their server reads and their client writes are removed. Until 02 lands, Offline start-up shows the defaults for these two.
- [ ] The first-paint browser tests seed choices through the real API and open the groceries page as an iPhone and as a desktop. They assert:
  - [ ] the stored view and grouping on the kind they were set on;
  - [ ] the defaults on the other kind;
  - [ ] the defaults when nothing is stored.
- [ ] The 0.25.0-beta release notes gain an Upgrade notes bullet: display choices reset once, and are now kept on your profile, per phone or desktop.
