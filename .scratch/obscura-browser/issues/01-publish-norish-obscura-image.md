# 01 — Publish the Norish Obscura image

**What to build:** Establish the reproducible browser artifact that the Norish application and every supported deployment will use for rendered-page imports.

**Blocked by:** Nothing

**Status:** ready-for-agent

- [ ] Norish builds its Obscura image from one explicitly pinned upstream source revision rather than from a floating branch, tag, or upstream image.
- [ ] The image build enables Obscura's full stealth feature, and the shipped service always starts Obscura with stealth enabled.
- [ ] The runtime command retains Obscura's private-network protection and exposes no supported switch that adds `--allow-private-network`.
- [ ] One immutable image version is published as a multi-architecture manifest with native Linux AMD64 and ARM64 variants.
- [ ] Active release automation can rebuild and publish the pinned artifact without relying on undocumented workstation state.
- [ ] The selected tag and source revision are recorded together so a release can prove which upstream source it contains.
- [ ] Required Obscura licensing and attribution accompany the owned image and its build source.
- [ ] An application release cannot publish configuration that references the image until that immutable image version is available.
- [ ] The artifact contract is validated through its build and manifest metadata; no Obscura behavior, anti-bot, or live-site compatibility suite is introduced.
