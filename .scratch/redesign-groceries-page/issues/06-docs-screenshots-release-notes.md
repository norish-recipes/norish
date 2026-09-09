# 06: Docs, screenshots and release notes

Status: ready-for-agent
Blocked by: 02, 03, 04, 05

Spec: `.scratch/redesign-groceries-page/spec.md`

## What to build

A docs reader sees the page as it now is. The Aisles page and the 0.23.0-beta release notes stop saying the Aisles sit "under the icon picker" and say under the colour. The seven groceries screenshots that showed a tinted header, an icon disc or the icon picker are re-shot with the two existing docs-screenshot specs, one for Aisles and one for prices, each in its own Playwright invocation. The dashboard screenshots are checked and re-shot only if the groceries list is visible in them. The current release-notes checkpoint page, 0.23.0-beta at the time of writing, gains a paragraph on the redesigned page: headings on the ground, the dot, tinted checkboxes, the done row, and the icon gone. The docs site builds.

## Notes

- The two docs-screenshot specs share a database and must never run in the same Playwright invocation.
- The docs app is outside the pnpm workspace; build it with npm inside its own directory, and it hard-fails on an unresolvable Markdown image.
- Capture with reduced motion, and grow the viewport rather than stitching a scrolling capture; the groceries list scrolls in its own container, so a full-page capture does not reach it.
- If the release checkpoint has moved when this ships, the new checkpoint's page is where the paragraph goes.

## Acceptance criteria

- [ ] No docs page or release note mentions an icon picker.
- [ ] Every groceries screenshot shows the new heading, dot and card; the dashboard shots are confirmed unaffected or re-shot.
- [ ] The current release-notes checkpoint carries a paragraph on the redesign.
- [ ] The docs site builds.
