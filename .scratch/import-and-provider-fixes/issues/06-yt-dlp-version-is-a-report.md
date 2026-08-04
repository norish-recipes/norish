# 06 — yt-dlp Version becomes a report

**What to build:** An administrator checking which downloader their server runs gets the truth.
Today the admin screen offers a **yt-dlp Version** field that is editable, saved, and read by
nothing at all — while the troubleshooting docs point operators at it precisely when imports
break. Across the fleet it displays the environment value on fresh installs, a stale string on
older ones, or whatever an administrator typed, because seeding only fills missing keys.

**Blocked by:** 01.

**Spec:** `.scratch/import-and-provider-fixes/spec.md`

**Status:** ready-for-agent

The version cannot be a setting: production fixes it by image, and in development the
downloader is only fetched when absent, so changing the environment value never re-downloads.
It becomes a report of what is actually there.

- [ ] The admin video processing screen shows the version of the downloader binary the server
      is actually running, obtained by asking the binary.
- [ ] The field is read-only. It stops inviting an administrator to change something no setting
      can change.
- [ ] When no binary is present, the screen says so plainly rather than displaying a version.
- [ ] The version leaves the writable video configuration — saving the screen no longer sends
      it.
- [ ] Locale strings stop describing it as a version "to use" and describe a report, in every
      supported locale.
- [ ] Seeding no longer fills the value from the environment.
- [ ] The shipped-release constant keeps its two real consumers — the environment default and
      the image build argument, already pinned together by a repo-invariant test — and its
      documentation stops naming the seeded config and the admin screen among them.
- [ ] Covered at the admin query with the version lookup faked: the reported value, and the
      no-binary case.

## Comments
