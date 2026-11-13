# 16: Share Extension

**What to build:** A SwiftUI Share Extension that imports a shared link, text or images straight to the server, confirms and closes. See `.scratch/mobile-redesign/spec.md` Part 2 ("Share Extension") and ticket 07's Share Extension boards. **Implement and review on Opus at high effort:** it moves the session cookie.

**Blocked by:** 15

**Status:** open

- [ ] Added through a config plugin (`ios/` is generated); App Group and shared keychain access group on app and extension.
- [ ] The Server Address and session cookie reach the extension through them; Better Auth's SecureStore items move into the group once on upgrade, with nothing left behind under the old group.
- [ ] Links, text and images call `importFromUrl`, `importFromPaste` or `importFromImages`; the sheet confirms and closes.
- [ ] Unreachable: saved to the App Group with its line; the app drains saved items into the Outbox on foreground (unit test).
- [ ] Signed out or no Server Address, too-old server, images with AI off, other failures: one line and Close.
- [ ] Strings generated from `packages/i18n` at prebuild.
- [ ] Checked by hand on a device: Safari, Photos, a text share, offline, signed out.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
