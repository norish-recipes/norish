# Unit economics of one paying user (EUR 2.50/month tier)

Researched 2026-11-26 from vendor pricing pages (fetched that day). Marked **[unverified]** means not confirmed on a primary page in this pass (memory, inference, or the page was blocked/unclear). USD to EUR assumed 1 USD = EUR 0.86 **[unverified]**; fixed fees below are rounded up (USD 0.50 = EUR 0.45).

## 1. Payment fees

| Provider | Fee (source) | Notes |
|---|---|---|
| Paddle (MoR) | 5% + 50c per checkout transaction (paddle.com/pricing) | Products under $10 "may get bespoke pricing", contact sales. Percentage assumed to apply to the tax-inclusive total **[unverified]**. |
| Lemon Squeezy (MoR) | 5% + 50c, +1.5% international, +0.5% subscriptions (docs.lemonsqueezy.com/help/getting-started/fees) | **No new sign-ups; shuts down 31 March 2027** per that page. Exclude. |
| Polar (MoR) | Starter 5% + 50c; Pro ($20/mo) 3.8% + 40c; +1.5% non-US cards; Stripe payout fees passed through ($2/month active payouts, 0.25% + $0.25 per payout); $15 per dispute (polar.sh/docs/merchant-of-record/fees) | EU buyers pay the +1.5%, so Starter is 6.5% + 50c. |
| Creem (MoR) | 3.9% + 40c, no monthly fee (creem.io/pricing) | Cheapest MoR on a small ticket. EU VAT remittance coverage and payout terms **[unverified]**. |
| Stripe direct (NL) | EEA standard cards 1.5% + EUR 0.25; premium EEA 2.8% + 0.25; UK 2.5% + 0.25; iDEAL EUR 0.29 flat; Billing 0.7% of volume; Tax Basic 0.5% per transaction (no-code) (stripe.com/en-nl/pricing) | Not a MoR. You register for VAT / EU OSS and file returns yourself. |

### What is left from EUR 2.50 gross (NL VAT 21%)
VAT = 2.50 - 2.50/1.21 = EUR 0.434; net of VAT EUR 2.066. Yearly: EUR 25 gross, VAT 4.34, net 20.66. MoR fees applied to the gross price; Stripe fees to the gross card charge.

| Provider | Monthly EUR 2.50: fee | Left | Yearly EUR 25: fee | Left (per month) |
|---|---|---|---|---|
| Stripe card + Billing + Tax | 0.0375+0.25+0.0175+0.0125 = 0.32 | **1.75** (70%) | 0.375+0.25+0.175+0.125 = 0.93 | **1.65** |
| Stripe iDEAL (no Billing/Tax) | 0.29 | 1.78 | n/a (iDEAL not recurring-friendly **[unverified]**) | |
| Creem | 0.0975+0.35 = 0.45 | **1.62** | 0.975+0.35 = 1.33 | **1.61** |
| Paddle | 0.125+0.45 = 0.58 | **1.49** (60%) | 1.25+0.45 = 1.70 | **1.58** |
| Polar Starter (EU card) | 0.1625+0.45 = 0.61 | **1.45** | 1.625+0.45 = 2.08 | **1.55** |

Reading: on a EUR 2.50 charge the fixed fee dominates (Paddle takes 23% of the gross). Yearly billing recovers roughly EUR 0.09 to 0.13 per month on MoRs. Stripe direct leaves the most but moves VAT compliance to you (OSS filing, invoices) **[admin cost not priced]**.

## 2. AI unit prices (USD per 1M tokens, standard tier)

Sources: ai.google.dev pricing (now aistudio.google.com/docs/pricing), developers.openai.com/api/docs/pricing, platform.claude.com/docs/en/about-claude/pricing, docs.mistral.ai/inference/pricing, console.groq.com/docs/models.

| Model | Input | Output |
|---|---|---|
| Claude Haiku 5.5 (prompts <=100k) | 0.10 | 0.50 (note: newer tokenizer yields ~30% more tokens than Haiku 4.5-era counts) |
| Claude Haiku 4.5 | 1.00 | 5.00 |
| Gemini 2.5 Flash-Lite | 0.10 | 0.40 (deprecated; from 1 Dec 2026 routed to 3.5 Flash-Lite pricing) |
| Gemini 3.1 Flash-Lite | 0.25 (audio 0.50) | 1.50 |
| Gemini 3.5 Flash-Lite | 0.30 (audio 0.30) | 2.50 |
| Gemini 3 Flash Preview | 0.50 (audio 1.00) | 3.00 |
| Gemini 3.6 / 3.8 Flash | 0.75 (1.50 from 1 Jan 2027) | 3.75 (7.50 from 1 Jan 2027) |
| gpt-5-nano | 0.05 | 0.40 |
| gpt-5.4-nano | 0.20 | 1.25 |
| gpt-5-mini | 0.25 | 2.00 |
| gpt-5.4-mini | 0.75 | 4.50 |
| Mistral Small 4 | 0.15 | 0.60 |
| Ministral 3 (3B / 8B / 14B) | 0.10 / 0.15 / 0.20 | 0.10 / 0.15 / 0.20 |
| Groq gpt-oss-20b | 0.075 | 0.30 |

Reasoning-capable models (gpt-5 family, Gemini Flash "thinking") bill thinking tokens as output, so real output can exceed the visible JSON **[unverified magnitude]**. Batch is 50% off at Anthropic (Haiku 5.5 batch 0.05/0.25) but imports are interactive.

Transcription: Groq Whisper Large V3 Turbo $0.04/hour, Large V3 $0.111/hour (minimum billed length **[unverified]**); OpenAI whisper $0.006/min, gpt-4o-mini-transcribe $0.003/min, gpt-4o-transcribe $0.006/min, gpt-transcribe $0.0045/min; Mistral Voxtral Mini Transcribe 3 $0.0035/min; Gemini audio input $0.30 to $1.00 per 1M tokens (audio tokens per second ~32 **[unverified]**, so 2 min ~3.8k tokens, ~$0.001 to $0.004).

Image generation per image: gpt-image-1-mini $0.005 / $0.011 / $0.036 (low/medium/high, 1024x1024); GPT-Image-2 $0.006 / $0.053 / $0.211; GPT Image 1.5 $0.009 / $0.034 / $0.133; Gemini 3.1 Flash Lite Image $0.0336 (1K); Gemini 3.1 Flash Image $0.067 (1K); Gemini 3 Pro Image $0.134 (1K/2K). OpenAI's per-image table is labelled legacy; prompt/input tokens extra. Imagen not listed on Google's page.

### Per-operation cost (assumptions, mine)
Import = 10k input + 2k output tokens (page text to structured recipe). Enrichment set = 5 small calls of 1.5k in / 300 out. Video = 2 min transcription + one import-size extraction on the transcript.

| Operation | Cheapest | Mid (Flash-Lite 3.1 / Mistral Small / gpt-5.4-nano) | Pricier (Flash 3.6 / gpt-5.4-mini) | Planning figure |
|---|---|---|---|---|
| Recipe import | $0.0013 (gpt-5-nano) to $0.002 (Haiku 5.5) | $0.0027 to $0.0055 | $0.015 to $0.0165 | **$0.010** |
| Enrichment set | ~$0.001 | ~$0.004 | ~$0.012 | **$0.005** |
| 2-min video | transcription $0.0013 (Groq turbo) + extraction | transcription $0.003 to $0.007 + $0.005 | $0.012 (whisper) + $0.015 | **$0.017** |
| Generated image | $0.005 (gpt-image-1-mini low) | $0.034 to $0.036 | $0.053 to $0.067 | **$0.035** |

Video download/ffmpeg compute is not in the above; it is server CPU time.

## 3. Hosting

Hetzner Cloud, EU, excl. VAT (hetzner.com/cloud/*; several plans showed "currently unavailable" at capture, check console):
- Cost-optimized: CX23 2 vCPU/4 GB/40 GB EUR 5.99; CX33 4/8/80 EUR 8.99; CX43 8/16/160 EUR 16.49; Arm CAX11 2/4/40 EUR 6.49; CAX21 4/8/80 EUR 10.99; CAX31 8/16/160 EUR 21.49.
- Regular performance (CPX): CPX22 2/4/80 EUR 16.99 (HEL) to 19.99 (NBG); CPX32 4/8/160 EUR 30.49 to 35.99.
- 20 TB traffic included in EU. Backups from EUR 1.098/month per instance (docs say "related to instance"; 20% of server price **[unverified]**). IPv4 EUR 0.50/month, IPv6 free.

Object storage per GB: Hetzner Object Storage EUR 6.49/month base incl. 1 TB storage + 1 TB egress (egress overage line on the page was garbled, confirm); Cloudflare R2 $0.015/GB-month, free egress, 10 GB free, Class A $4.50/M, Class B $0.36/M; Backblaze B2 from $6.95/TB-month, egress free up to 3x stored, first 10 GB free. For uploads of recipe images (tens of MB per user) the app's own disk (80 to 160 GB on the box) is enough at launch; move to R2/B2 only for offsite backups (a few EUR/month at <500 GB).

Managed Postgres: Hetzner Cloud has none (**[unverified]**, from memory); EU managed options (Scaleway, OVH, Aiven) are priced several times the VM and were not fetched. Self-run Postgres + nightly `pg_dump` to R2/B2 + Hetzner server backup costs about EUR 2 to 4/month **[estimate]**.

Capacity (my estimate, not benchmarked **[unverified]**): the repo's own measure is ~250 MB at start and ~314 MB idle for the server process (memory note, 2026-11-20). A 4 vCPU / 8 GB box (CX33 EUR 8.99 or CAX21 EUR 10.99) running Next + Postgres + Valkey + workers comfortably serves several thousand mostly-idle households; the real limit is concurrent imports (headless browser scraping, yt-dlp, ffmpeg), so cap job concurrency. All-in fixed cost ~EUR 15 to 20/month (box, backup, IPv4, offsite backups, domain, monitoring). Per user: EUR 0.20 at 100 users, EUR 0.02 at 1,000.

## 4. Transactional email

| Provider | Price | EU residency | SMTP |
|---|---|---|---|
| Scaleway TEM | page blocked (403); ~EUR 0.25/1k, free allowance **[unverified]** | EU (French provider) **[unverified]** | Yes **[unverified]** |
| AWS SES | $0.10/1,000 (+$0.12/GB attachments); dedicated IP $24.95/mo; $200 new-customer credit | EU regions exist **[unverified on page]** | Yes **[unverified]** |
| Postmark | Free 100/mo; $15 for 10k, overage $1.80/1k | Not stated (address Chicago) | Yes **[unverified]** |
| Resend | Free 3,000/mo but 100/day; Pro $20 for 50k | Not stated on page (EU region **[unverified]**) | Yes |
| Brevo | Free daily-capped plan; Starter paid | EU hosting offered; figures not on page | Yes (free incl.) |
| Mailgun | Free 100/day; Basic from $15 for 10k; Foundation $35 for 50k | US and EU regions, one account | Yes |
| Cloudflare Email Service | 3,000/mo included on Workers Paid, then $0.35/1k | Not stated | Yes (authenticated SMTP, Workers binding, REST) |

Volume is ~0.1 to 0.5 mails per user per month (verify, reset), so cost is ~EUR 0 per user on any free tier; pick on EU residency and deliverability (Mailgun EU, Brevo, Scaleway) rather than price. Free tiers are daily-capped (100/day) which a signup burst can hit.

## 5. Worked monthly cost model per user (EUR)

Shared assumptions: planning-figure AI costs from section 2, USD x 0.86; hosting + backups + email + storage allocated at EUR 0.15/user (about 130 users on a EUR 20 all-in setup, optimistic early, EUR 0.02 at 1,000). Excludes support time, chargebacks/disputes, free-tier users, VAT admin, refunds.

**Light user** (5 imports, each with enrichment, no image generation)
- AI: 5 x ($0.010 + $0.005) = $0.075 = EUR 0.065
- Hosting/email/storage: EUR 0.15
- **Total about EUR 0.22** (range 0.10 to 0.30)

**AI-heavy user** (40 imports with enrichment, 10 videos, 10 generated images)
- Imports: 40 x $0.015 = $0.60
- Videos: 10 x $0.017 = $0.17
- Images: 10 x $0.035 = $0.35 (at $0.067: $0.67)
- AI total $1.12 to $1.44 = EUR 0.96 to 1.24
- Hosting/email/storage: EUR 0.20 (extra CPU for video, more stored images)
- **Total about EUR 1.15 to 1.45**; with pricier text models (Flash 3.6 / gpt-5.4-mini, ~3x text cost) about EUR 1.6 to 2.0.

### Margin on the EUR 2.50 tier (monthly billing, after VAT and payment fees; fee rows from section 1)

| | Stripe | Creem | Paddle | Polar |
|---|---|---|---|---|
| Left of 2.50 | 1.75 | 1.62 | 1.49 | 1.45 |
| Light user (cost 0.22) | +1.53 | +1.40 | +1.27 | +1.23 |
| AI-heavy (cost 1.15 to 1.45) | +0.30 to +0.60 | +0.17 to +0.47 | +0.04 to +0.34 | 0.00 to +0.30 |

## 6. Implications

- A EUR 2.50 tier works only for light usage: a light user costs ~EUR 0.2 and leaves EUR 1.2 to 1.5. An AI-heavy user wipes the margin on any MoR and is break-even on Polar/Paddle. Do not include uncapped video and image generation in it.
- Biggest levers, in order: (1) payment provider (fixed fee is EUR 0.25 to 0.45 of a 2.50 charge); (2) cheap model choice for import (Haiku 5.5 / Flash-Lite / Mistral Small keep an import under 1 cent, a 3x pricier model triples the heavy-user bill); (3) cap images and videos, since images are ~25 to 30% of heavy cost; (4) yearly billing at EUR 25.
- Include in the EUR 2.50 tier a monthly AI allowance, e.g. ~20 imports and a few videos, no image generation (worst case ~EUR 0.5), with the rest on a higher tier or pay-per-use credit.
- Higher AI tier: at EUR 5.00/month gross (net 4.13): Stripe fees ~0.37 (left 3.76), Paddle 0.70 (left 3.43, and Paddle's share falls to 14%). Heavy user (EUR 1.2 to 2.0 cost) leaves ~EUR 1.5 to 2.5 margin. EUR 4 to 5 with a hard allowance (e.g. 40 imports, 10 videos, 10 images) is viable; metered overage beyond it at about 3x cost.
- Compliance choice: Stripe direct is ~EUR 0.15 to 0.30 per user per month better than Paddle/Polar but you own EU VAT (OSS) and invoicing; MoR removes that at the price of 15 to 20% of the tier. Lemon Squeezy is out (sunset 31 March 2027).
- Next checks before pricing: confirm Paddle's sub-$10 bespoke rate, Creem's VAT/MoR coverage and payout fees, a real benchmark of import concurrency on a CX33, and actual tokens per import from the job monitor model ledger rather than the 10k/2k assumption.
