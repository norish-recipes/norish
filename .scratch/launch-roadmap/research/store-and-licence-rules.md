# Store rules and licence risk for the Norish mobile app

Researched 2026-11-26. Not legal advice. Status tags: [VERIFIED] read from the primary source this session, [SECONDARY] only seen in a secondary write-up, [UNCERTAIN] inference or unresolved.

Plan under review: free download, self-hosters pay a one-time in-app unlock to use the app against their own server, hosted-service subscribers (bought on the web via a merchant of record) use it free.

## 1. Subscription bought outside the app

### Apple

- 3.1.1: "If you want to unlock features or functionality within your app ... you must use in-app purchase. Apps may not use their own mechanisms to unlock content or functionality, such as license keys ..." [VERIFIED, https://developer.apple.com/app-store/review/guidelines/]
- 3.1.3(b) Multiplatform Services: apps "may allow users to access content, subscriptions, or features they have acquired in your app on other platforms or your web site ... provided those items are also available as in-app purchases within the app." [VERIFIED, same page]
  - Reading: unlocking from a web purchase is allowed only if the same thing can also be bought via IAP in the app. So the hosted subscription (or an equivalent unlock) must be offered as IAP. The text does not require identical price. [UNCERTAIN how strictly review enforces "also available"; no Apple clarification found.]
  - Practical consequence: the one-time self-hoster IAP does not satisfy this for the hosted subscription. Either add a hosted-subscription IAP, or make the hosted entitlement not "unlock" anything in the app (see 3.1.3(f) below).
- 3.1.3(f) Free stand-alone apps: "Free apps acting as a stand-alone companion to a paid web-based tool for VoIP, Cloud Storage, Email Services, or Web Hosting do not need to use in-app purchase, provided there is no purchasing inside the app, or calls to action for purchase outside of the app." [VERIFIED] A hosted recipe service is not obviously one of the four named categories, and the plan has in-app purchasing, so this does not fit. [UNCERTAIN, my reading]
- 3.1.3 intro: apps using other purchase methods "cannot, within the app, encourage users to use a purchasing method other than in-app purchase, except for apps on the United States storefront and as set forth in 3.1.1(a) and 3.1.3(a)." Outside-the-app communication to existing users is allowed. [VERIFIED]
- 3.1.3(a) Reader apps (magazines, newspapers, books, audio, music, video) only. Recipes are not on that list. [VERIFIED list]
- 3.1.1(a) external links: entitlements are "not required ... in their United States storefront apps" for buttons, links and calls to action. Elsewhere you need a StoreKit External Purchase Link Entitlement in the permitted regions; in other storefronts links to non-IAP purchase are banned. [VERIFIED]
- Can "log in with an account bought on the web" be sold in-app as IAP too? Yes, and that is the safe pattern: the web price and IAP price may differ; the entitlement is the user's server-side account.

### Epic v. Apple (US)

- 2025-04-30 district court found Apple in civil contempt, barred any commission on US external purchases and the anti-steering restrictions. 2025-12-11 Ninth Circuit affirmed contempt and most remedies but vacated the total commission ban and remanded for a tailored sanction or modification. En banc rehearing denied 2026-03-30. [SECONDARY, https://ipwatchdog.com/2026/06/30/high-court-grants-cert-in-apples-challenge-to-ninth-circuit-contempt-ruling-in-app-store-dispute/]
- Supreme Court granted cert 2026-06-30 (Apple v. Epic, No. 25-1311); Apple's merits brief 2026-09-14; no decision seen as of today. Questions: contempt for violating an injunction's "spirit", and scope of relief after Trump v. CASA. [SECONDARY via ipwatchdog/Oyez/Supreme Court docket search results]
- Apple's proposed post-remand link-out commission: 12-27% in one report, 15% / 10% in an August 2026 report. [SECONDARY, conflicting, UNCERTAIN what is in force]. Treat the US zero-commission link-out as possibly temporary; the guideline text today still lets US-storefront apps include buttons and links without an entitlement.
- Do not build the business case on US-only link-outs. The core design (no in-app purchase of the hosted plan, entitlement checked server-side) survives any outcome.

### Apple EU (DMA)

- June 2025 notice: developers can promote offers at a destination of their choice, with fees (initial acquisition, store services, Core Technology Commission) under StoreKit External Purchase Link Entitlement (EU) Addendum. [VERIFIED, https://developer.apple.com/news/?id=awedznci]
- August 2026 announcement (effective 2026-10-01): acquisition and store services fees dropped, CTF replaced by a 5% CTC for apps outside the App Store, 15% (10% in some programs) commission on App Store apps that link out, 26% for IAP apps. [SECONDARY, search snippets of apple.com/newsroom/2026/08; one regional page listed 20% for alternative payments, UNCERTAIN]. Read the addendum before relying on rates.
- Under-13 users cannot be linked out; parental gate under 18. [SECONDARY]

### Google Play

- Payments policy: digital items, subscriptions, app functionality and cloud software generally must use Play Billing. Exemption: "consumption-only" apps where a user logs in and accesses content paid elsewhere, if nothing can be purchased in the app. In-app links to other payment methods are prohibited unless a program applies. [VERIFIED, https://support.google.com/googleplay/android-developer/answer/10281818]
- US (Epic v. Google): since 2025-10-29 developers may tell US users about off-Play pricing, link out, and use other payment methods; Play will not require Play Billing there. External content links and alternative billing programs still exist; enrolled developers must report transactions and downloads and pay service fees from 2026-10-01 (external-links downloads by 2027-02-01). No amounts on the page. [VERIFIED, https://support.google.com/googleplay/android-developer/answer/15582165]
- March 2026 Google/Epic settlement and modified injunction: the joint motion was withdrawn mid-July 2026; third-party store catalog access went live 2026-07-22. [SECONDARY, MacRumors/Engadget]. Whether link-out fees apply without enrolment is disputed between sources. [UNCERTAIN, check Play Console]
- Outside the US, a consumption-only app (no purchase path in the app, no link) is the clean Play route; EEA and India/South Korea have alternative billing with fee reductions. [VERIFIED for the policy page]

Conclusion for Q1: as designed, hosted subscribers using the app free is allowed on Google if there is no in-app purchase for that plan, and on Apple only if that plan is also an IAP (3.1.3(b)) or you accept the risk. No Apple source says an entitlement based on an external subscription is banned outright. [UNCERTAIN: enforcement in practice, no reviewer-quoted precedent found]

## 2. One-time IAP to connect to your own server

- Apple 3.1.1 covers "unlocking a full version" as a legitimate IAP. A non-consumable "unlock the app to use with your own server" is an ordinary full-version unlock. [VERIFIED wording]
- Precedents (all [SECONDARY], store listings and vendor docs):
  - Emby: iOS listing says playback needs a small one-time IAP or an active Emby Premiere subscription; the unlock is tied to the store account and works against any Emby server. https://apps.apple.com/us/app/emby/id992180193 and Emby forum threads. This is the closest match to the plan, including "subscription bought elsewhere also unlocks".
  - Plex: "unlock Plex for iOS" one-time purchase, or Plex Pass. https://support.plex.tv/articles/205556278-unlocking-or-activating-plex-for-ios/
  - Hound (self-hosted media server): free for one user, paid licence for more. [SECONDARY]
- Not checked this session: Jellyfin/Swiftfin (free), Infuse, Home Assistant companion (free), Bitwarden. Do not cite them as precedent without checking.
- Risk: 4.2.7(e) "Thin clients for cloud-based apps are not appropriate" applies to remote desktop mirroring clients, not to a native recipe UI. Low risk. [VERIFIED text, UNCERTAIN relevance]
- Review needs a working demo login or demo server for reviewers; paid gate without one is a common rejection. [UNCERTAIN, general experience]
- 5.1.1(v): if the app supports account creation it must offer in-app account deletion. [VERIFIED]

## 3. Sign in with Apple (4.8)

- 4.8: apps that use a third-party or social login (Google, Facebook, X, etc.) to set up or authenticate the user's primary account must also offer an equivalent login (name and email only, private email option, no ad tracking). Exempt if the app "exclusively uses your company's own account setup and sign-in systems", among other listed exceptions. [VERIFIED, guidelines page]
- Education/enterprise apps requiring an existing education or enterprise account are exempt (text quoted in developer forums). [SECONDARY]
- Self-hosted OIDC: no Apple source says it is exempt. A customer-run OIDC provider is neither "your company's own" system nor clearly an "existing enterprise account". [UNCERTAIN, my reading]. Likely safe if the OIDC provider is the server operator's own IdP, since Norish does not choose it, but expect a review question.
- Safe options: do not ship Google/GitHub login in the mobile app (email+password and server-configured OIDC only), or add Sign in with Apple wherever Google/GitHub are offered. Developer forum threads show reviewers also object to sign-in that forces users out to the default browser; use an in-app auth session. [SECONDARY]

## 4. AGPL and the stores

### VLC and the FSF view

- 2010: FSF said App Store Usage Rules (device limit, mandatory ToS) are "further restrictions" forbidden by GPLv2 section 6, and the same applies to all GPL versions and the AGPL; Apple removed GNU Go. [VERIFIED, https://www.fsf.org/blogs/licensing/more-about-the-app-store-gpl-enforcement]
- 2011: VLC for iOS removed after a copyright complaint from a core developer (Remi Denis-Courmont); VLC later returned (2013) rewritten and under a licence that allowed it. [SECONDARY, 9to5mac / Slashdot / TechCrunch results]
- No current FSF or SFC statement found; the search returned only 2010-2011 material. Treat the FSF position as unchanged. [UNCERTAIN]

### Can a sole copyright holder ship AGPL code to the stores?

- Yes in principle: the copyright holder is not bound by the licence for their own code, and may distribute it under additional terms. The problem exists only for code owned by others (contributors, dependencies) that you ship under the store ToS. This is the standard reading and the reason projects dual-license or add exceptions; I did not find an FSF/SFC page that states it for AGPL directly (gnu.org GPL FAQ fetch failed). [UNCERTAIN, from general knowledge of the GPL FAQ]
- But Norish has contributors beyond Mike (git history shows 7 distinct authors; e.g. AfoxDesignz, Andre Santo, Eli Dylan Lorimer, Luca, Matthew Watts, others). Their commits are under AGPL-3.0 only (CONTRIBUTING.md line 434: contributions are licensed under AGPL-3.0). So Mike is not sole holder; shipping their code under Apple ToS is the exact VLC situation for those parts.
- Downstream recipients can still get the source and rebuild; the conflict is the store's added terms on the binary the store distributes.

### AGPL section 7 "app store exception"

- AGPL section 7 lets copyright holders grant additional permissions for the code they hold (or can give permission for); section 10 forbids imposing further restrictions on recipients. An exception text typically says: "As a special exception, the copyright holders give permission to distribute covered works through app stores under their terms of service, provided source is also available under AGPL-3.0." [UNCERTAIN: section wording from memory; the gnu.org AGPL fetch hit 429 and a retry returned nothing]. Re-read sections 7 and 10 of https://www.gnu.org/licenses/agpl-3.0.txt before drafting.
- An exception only binds code whose holders grant it. For contributed code you need each holder's permission, which is why a CLA (or a later consent from each author) is needed.

### Third-party contributed code in shared packages

- DCO: contributor certifies right to submit under the project's licence; no extra grant, so you cannot relicense or add exceptions without each contributor. CLA: grants the project broader rights and so can allow dual licensing or exceptions (the Linux Foundation notes a CLA is often chosen so the licence can change later; MongoDB did relicense using its CLA). [SECONDARY, https://bestpractices.linuxfoundation.org/ip/contribution-mechanisms-cla.html, https://ospo.docs.cern.ch/recommendations/CLAs-and-DCOs, https://opensource.com/article/18/3/cla-vs-dco-whats-difference]
- Options, least to most work:
  1. Add the section 7 app-store exception for future contributions via a CLA (or "licence-in grant") and ask the 6 existing contributors to agree by reply, keeping a record. Replace code of those who do not.
  2. Audit authorship of what actually ends up in the mobile bundle (apps/mobile plus packages/shared-react, packages/shared, packages/ui, packages/i18n, trpc types). Rewrite or remove files from non-consenting authors; small contributions may fall below copyright threshold (judgement call, UNCERTAIN).
  3. Separate the store-distributed client as a repo where Mike or a company holds all copyright, with AGPL for everyone else's use. Probably highest effort.
- Third-party npm dependencies: permissive licences (MIT, Apache-2.0) are generally fine in a store binary; check for GPL/LGPL/AGPL native deps in the Expo build. [UNCERTAIN, not audited]

## 5. Trademark policy to stop same-name forks

- Yes, this is the usual mechanism: copyright licences do not grant trademark rights; forks must rename. [SECONDARY, Forrester, Producing OSS, NLnet "Forking and Trademarks"]
- Examples: Mozilla (no "Firefox [Your Product]"), Mastodon (no "Mastodon" in server/product names), Matrix (policy published March 2026), Meta. https://www.mozilla.org/foundation/trademarks/, https://joinmastodon.org/trademark, https://matrix.org/blog/2026/03/2026-03-trademark-policy/
- To be effective you need the mark owned by a clear entity and, ideally, registered; store disputes (Apple/Google) are handled via trademark complaints on the listing name and icon. [UNCERTAIN, general]
- A trademark policy stops a fork publishing as "Norish" but not a free fork under another name, and it does not stop anyone from building and sideloading. It cannot fix the AGPL/store ToS conflict.
- Not checked: whether anyone currently holds a "Norish" trademark.

## Takeaways

- Offering the hosted plan only on the web plus an in-app unlock for the same entitlement is allowed on Google (consumption-only or, in the US, external-link programs). On Apple, 3.1.3(b) lets web purchases unlock the app only if the same item is also an IAP, so ship a hosted-subscription IAP or accept review risk. [UNCERTAIN enforcement]
- A one-time non-consumable IAP "unlock the app for your own server" fits 3.1.1; Emby (one-time or Premiere) and Plex (one-time or Plex Pass) are direct precedents. Provide a reviewer demo login.
- Do not count on US link-out zero commission: Epic v. Apple is at the Supreme Court (cert granted 2026-06-30, undecided as seen) and Google's US fee regime changes from 2026-10-01. Design so nothing depends on it. EU link-out carries commissions and needs the addendum.
- Avoid Guideline 4.8 by not offering Google/GitHub sign-in in the mobile app, or add Sign in with Apple; self-hosted OIDC is not clearly exempt. [UNCERTAIN]
- AGPL vs store ToS is a real conflict for code Mike does not own (VLC 2011, FSF 2010, still the FSF view as far as found). Mike alone can ship his own code; the 6 other authors' code needs their permission.
- Fix it with an AGPL section 7 app-store exception plus a CLA for future contributors, collect consent from existing contributors, and audit what is in the mobile bundle. DCO alone cannot do this. Read AGPL sections 7 and 10 and take counsel before submitting. [UNCERTAIN]
- A trademark policy is the normal way to stop same-name forks but does not stop renamed free forks or solve the licence issue; check ownership and registration of "Norish" first.
- Open items I could not verify: current US link-out commission after remand, Google US fee amounts, exact Apple EU rates, AGPL section text from gnu.org, no 2023-2026 FSF/SFC statement found.
