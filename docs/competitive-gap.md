# Sosial vs Repliz: feature gap and build ranking

Last updated: 28 October 2026

This is a working document, not marketing copy. It answers two questions:

1. What does Repliz ship that Sosial does not?
2. If we build those things for **web and mobile**, what is the order from easiest to hardest?

---

## 1. How this was produced

- Loaded `repliz.com`; it is a Vue SPA, so the landing HTML has no copy.
- Downloaded the shipped bundle (`/assets/index-CLCpQk0Y.js`, ~677 KB) and extracted the
  English UI strings. That covers the real app, not just the marketing page: plan limits,
  automation actions, inbox states, API tiers, error copy.
- Cross-checked every Sosial claim against this repo: `apps/web`, `src` (Expo), `apps/worker`,
  `supabase/migrations`, `supabase/functions`.
- Where Sosial has partial coverage, the gap says "partial" instead of "missing".

Caveat: Repliz has no public feature changelog, so "they have it" means it exists in the
current bundle. "Sosial doesn't" means no code path in this repo does it as of this commit.

---

## 2. What Repliz actually is

Not a scheduler with comments bolted on. It is **comment and DM automation first**, with
scheduling as a secondary feature.

- **11 connected platforms.** Rules run on Instagram, Facebook, Threads, TikTok, YouTube and
  LinkedIn. Scheduling-only on X, Shopee, WhatsApp, Telegram and Pinterest.
- **One-time billing** in 1, 3, 6 or 12 month blocks, no auto-renew.
- **Indonesia-first**: QRIS, bank transfer, e-wallets, Shopee, WhatsApp, Indonesian UI.
- **Plans**: Free (1 account, every automation), Standard, Premium, Gold. Higher plans add
  accounts, operators, scheduling, DM inbox and API access.
- **No calendar views, no post approval workflow.** Their "Content" screen is a schedule list.
  That is still Sosial's differentiator.

Their whole funnel is: connect an account → turn on a rule → never answer a comment manually
again. Scheduling exists so the account stays useful after the comments are handled.

---

## 3. What Sosial already has (do not rebuild)

| Area | Sosial today |
|---|---|
| Channels | 18 integrations wired; 16 live, LinkedIn and Google Business Profile are preview |
| Publishing | Day/week/month/year/list calendar, queue, per-channel times, post now or schedule |
| Composer | Per-channel limits, previews, threads, templates, designs, stories/reels for IG/FB |
| Approvals | Owner/admin/member roles, review queue, approve or send back with a note |
| Inbox | Comments and DMs from FB, IG, Threads, X, Mastodon, Bluesky, YouTube; manual reply |
| Inbox transport | `reply-comment`, `inbox-fetch`, `inbox-send`, realtime inbox, comment sync |
| AI | Writer, per-channel captions, blog/studio drafts, image search (Pexels, Unsplash) |
| Imports | Notion and Google Sheets |
| Media | Library, Dropbox/Canva/OneDrive, watermark, retention rules |
| Developer | `/api/v1/me`, `/api/v1/posts`, MCP endpoint, workspace API keys with scopes |
| Ops | Notifications, push, announcements, billing, team invites, channel pools, blog CMS |

Anything in this table is out of scope for the ranking below.

---

## 4. The gap, grouped

### 4.1 Comment and DM automation (their core)

- Six rule actions: **reply**, **delete/hide**, **like**, **DM the commenter**, **reply to a
  story reply**, **answer a DM**.
- Keyword matching with a different reply per keyword; blank keyword = default reply.
- Exception list checked before keyword matching (skip competitor names, etc.).
- Exact-match toggle (whole comment vs. contains).
- 10–60 second delay so replies do not land instantly.
- Scope: account-wide rule that also covers future posts, or a per-post override.
- Automation templates: save a rule set, apply it to any post.
- AI moderation: hide/delete by an AI prompt, with the post caption and media as context.
- AI replies from a prompt, with the post as context.
- Instagram Live comments toggle.
- Story reply automation (auto-DM everyone who reacts to a story).
- "Prevent Before Follow": DM a link, withhold the follow-up until the person follows.
- DM flows: opening button message → follow-up links; up to 10 cards × 3 buttons.
- Platform-aware fallback: Threads and TikTok cannot delete other people's comments, so the
  action hides instead.
- Inbox states: pending / resolved / ignored; auto-handled comments resolve themselves;
  comments stay in the inbox for 30 days.
- Automation report: every handled comment and the action taken, filterable and exportable.

**Sosial today:** manual replies only. `comments.status` is `new | replied | hidden | deleted`;
the UI uses `new` and `replied`. No rule engine, no keyword matching, no auto-moderation.

### 4.2 AI agent assistant

A chat agent with tools over the workspace, not a writing sheet:

- Reads and manages comments, DMs, schedules, posts, automations and account stats.
- Asks **Allow / Reject** before any write; a new message cancels the pending action.
- Chat history with rename, delete and search; attachments; stop and streaming.
- BYO AI key (Gemini, OpenAI, DeepSeek) or a Repliz token balance (runs on Gemini).
- Per-request token usage history.

**Sosial today:** AI generation sheets and MCP tools, but no conversational surface over the
workspace.

### 4.3 Research suite

- **TikTok**: search videos, photos, users and hashtags; trending music; filters; download
  slides and posts. Runs on the customer's own TikWM key.
- **Threads**: post and profile search through a connected Threads account, with sort, media
  type, date range and username filters.

**Sosial today:** AI ideas and stock image search, but no platform content research.

### 4.4 Developer platform breadth

- Public API covers Me, Account, Comment, Addon, Schedule, Chat, Content, Research, Report,
  Automation and **OAuth** for third-party apps.
- Outbound webhooks: POST JSON per event, `x-token` header, test event on save (must return
  2xx), manual retry log.
- n8n node and MCP server, tiered like the API.
- Per-operator API keys, separate from the owner's.

**Sosial today:** posts and me endpoints, MCP, workspace keys with
`posts:*`, `channels:read`, `media:read`, `analytics:read`. No outbound webhooks, no n8n, no
comments API, no OAuth provider.

### 4.5 Team, auth and security

- Operator accounts: separate login, admin picks which **menus** and which **accounts** the
  operator can see. Dashboard and Settings are always visible.
- TOTP two-factor authentication with authenticator apps; operators are exempt.
- Device and session list with remote sign-out; sessions expire after 7 days idle.
- Google sign-in, email verification codes, phone verification.

**Sosial today:** owner/admin/member roles and per-channel grants, but no restricted-menu
logins, no 2FA, no session management.

### 4.6 Billing and monetization extras

- Affiliate program: referral codes, commission on signup (phone-verified) and on every
  payment, withdrawal ledger, admin mark-paid.
- Coupons scoped to plans, add-ons or AI tokens.
- Redeem codes: gift plans, extend time, custom N-day plans.
- Add-ons: extra accounts, extra operators, storage.
- AI token balance sold in 100k blocks on any plan.
- X credits: one per scheduled post or reply.
- Storage add-on: 150 MB per file, 90-day retention, used by API and assistant.

**Sosial today:** Stripe subscriptions only. No coupons, affiliate, add-ons or metered AI.

### 4.7 Channel and format gaps

- WhatsApp publishing: Status, own Channels, groups (third-party integration).
- Shopee seller account scheduling.
- Telegram story/channel/group posting and DM answers (Sosial has channel posting).
- Pinterest board-level scheduling with destination links.
- XLSX bulk import with per-row validation (Sosial has Notion and Google Sheets instead).
- Auto-add trending music, product tagging, alt text, link cards with up to 3 buttons,
  album minimum of 2 media.

### 4.8 Smaller polish items

- Guided product tour, per menu, skippable, reopenable from settings.
- Comment volume summary: handled / waiting / ignored, with export.
- Manual "Post again" for failed content.
- Per-message attachment limits and pre-apply character-limit warnings.

---

### 4.9 Permission requirements (read this before the ranking)

Not every gap needs new platform access. This is the split that decides what can ship
without waiting on Meta, TikTok, LinkedIn or a partner.

| Need | Items | Notes |
|---|---|---|
| **No new access** | A, B, C, D, E, G, H, I, J, K, N, O, P, R, S, U | DB, existing worker, existing OpenAI usage, Stripe, Supabase auth. |
| **Reply-only rules** | Q (reply action only) | Comment read and reply are already in the shipped comment sync and `reply-comment`. |
| **Existing scopes, policy risk** | T (DM automation) | `inbox-send` already messages on FB, IG, X, Bluesky and Mastodon. The 24-hour window and anti-spam rules are policy, not a new scope. |
| **New platform permission / review** | F (manual like/hide/delete), Q (like + hide/delete actions), V (story replies, follow-gate), W (Instagram Live comments) | Meta controls comment moderation and messaging scopes; Threads/TikTok only hide. Budget review time, not just code. |
| **Third-party API key** | L (TikWM key), M (Threads search scope), P (optional AI key) | L runs on the customer's own TikWM key; M needs a Threads permission; P is optional because Sosial's AI already works. |
| **Partner / provider approval** | Y (WhatsApp Business provider), Z (Shopee partner API, OAuth app review) | Contract and review time dominate. |
| **No platform permission, but product work** | Affiliate, coupons, redeem codes, add-ons, X credits | Billing and ops, not API access. |

**Safe to build now, with no new API permission:** `A, B, C, D, E, G, H, I, J, K, N, O, P, R, S, U`
plus the reply-only slice of `Q`.

**Wait for approval or a partner:** `F`, the like/hide/delete actions in `Q`, `V`, `W`, `Y`, `Z`.
`L` and `M` only need a third-party key or an existing account, not a platform review.

---

## 5. Build ranking A–Z

Ordered **easiest to hardest** for a feature that has to work on **both web and mobile**.

Size legend, assuming one full-stack developer who knows this repo, including both surfaces:

| Size | Meaning |
|---|---|
| XS | 1 day or less |
| S | 2–4 days |
| M | 1–2 weeks |
| L | 3–5 weeks |
| XL | 6+ weeks |

The estimates exclude App Store review and Meta/TikTok/LinkedIn permission waiting, which are
calendar time, not code time. "Permission risk" means platform review or API scope risk.

### Tier 1 — UI over data we already have

| # | Feature | Size | Web | Mobile | Backend | Permission risk |
|---|---|---|---|---|---|---|
| A | **Comment report + CSV export** (`handled / waiting / ignored`, per account, date range) | XS | New report page under Analytics | New screen or a tab in Analytics | None: read `comments` + `channels` | None |
| B | **Guided product tour** (per menu, skippable, reopenable) | XS | Overlay component, localStorage flag | Overlay + AsyncStorage flag | None | None |
| C | **Inbox states `resolved` / `ignored` + auto-resolve** | S | Status filter + bulk action in `CommunityInbox` / `CommentsFeed` | Same in `CommunityScreen` | One migration; widen the `comments.status` check; auto-resolve on reply | None |
| D | **Pre-apply limit warnings + per-message attachment caps** | S | Composer validation | `ScheduleEditor` / `CreateScreen` validation | None | None |
| E | **Manual "Post again" for failed posts** | S | Button on failed post card | Same on queue card | Small RPC or reuse queue recovery; no new worker | None |

### Tier 2 — small backend, contained UI

| # | Feature | Size | Web | Mobile | Backend | Permission risk |
|---|---|---|---|---|---|---|
| F | **Manual comment like / hide / delete** | S–M | Buttons in `CommentsFeed` | Buttons in `CommunityScreen` | Extend `reply-comment` or add `comment-action`; adapter methods already stubbed in `facebook.ts` / `instagram.ts` | Medium: Meta comment moderation scopes; Threads/TikTok hide only |
| G | **XLSX bulk import** | S–M | New tab in `ImportTabs`, client-side parse | Import from Files, same parse | Reuse the Sheets import path; no new tables | None |
| H | **TOTP 2FA** | M | Enroll/verify/recovery in Account settings | Same in `AccountScreen` | Supabase MFA (`auth.mfa.enroll/challenge/verify`), no custom crypto | None |
| I | **Public API: comments + schedules + docs** | M | API docs page, key scopes | Key management only | Add `comments:read/write`, `schedules:read/write`; reuse services | None |
| J | **Outbound webhooks + delivery log + retry** | M | Settings page, log table, retry | Settings list + retry | `webhook_endpoints`, `webhook_deliveries`; dispatcher in worker; HMAC or `x-token` | None |
| K | **X credits / metering** | M | Wallet + usage in Billing | Read-only balance + usage | Counter table, debit on publish, refund on failure | None |
| L | **TikTok research (TikWM)** | M | Research page | Research screen | Key storage (Vault), server proxy to TikWM, cache | Low: third-party key, rate limits |
| M | **Threads research** | M | Research page | Research screen | Existing Threads token; search + profile endpoints | Medium: Threads API search scope |

### Tier 3 — new product surface, shared engine

| # | Feature | Size | Web | Mobile | Backend | Permission risk |
|---|---|---|---|---|---|---|
| N | **Operator accounts + menu/account scoping** | M | Operator admin in Team, nav gating | Login option, tab gating, operator admin | `operator` flag, `menu_grants`, `account_grants`; extend team RPCs | None |
| O | **Device/session list + remote sign-out** | M | Devices list in Account | Same | Service-role route over GoTrue admin sessions | None |
| P | **BYO AI key + token balance + usage log** | M–L | Settings: provider key, balance, history | Same in `AccountScreen` | Encrypted key storage, provider adapter, token meter | None |
| Q | **Keyword rules engine v1**: reply, like, hide/delete; keywords, exceptions, exact match, delay, account/per-post scope | L | Rule builder + preview/dry-run | Rule builder in `CommunityScreen` | `automation_rules` + evaluator on new comments + action dispatcher + idempotency + rate limits | Medium–high: write scopes, per-platform differences |
| R | **Automation templates** (save/apply) | S–M | Template picker in rule builder | Same | Reuses rule tables; `automation_templates` | None |
| S | **Automation activity report + per-comment audit** | M | Report tab: every action, filter, export | Same screen | `automation_actions` log, written by the dispatcher | None |
| T | **DM automation v1**: keyword replies, AI replies, 24-hour window handling | L | Rule panel on DM inbox | Same | Extend `inbox-send`; conversation state, window checks, dedupe | Medium: messaging policy and 24h window |
| U | **AI agent assistant** (read tools first, write behind Allow/Reject) | L | Chat page + history | Chat screen + history | Tool layer over existing services; confirmation tokens; attachments via Storage | None |
| V | **Story reply automation + follow-gate** | L | Rule type in builder | Same | Story reply events, follow state, delayed follow-up scheduling | High: Instagram story/follow APIs |
| W | **Instagram Live comments** | L | Live toggle in rule | Same | Live comment subscription + short-lived session handling | High: Meta live permissions |
| X | **Auto-add music + trending music** | L | Music picker + preview | Same | TikTok music search and attach; country/genre filters | Medium: TikTok API |

### Tier 4 — new channels and partner platform

| # | Feature | Size | Web | Mobile | Backend | Permission risk |
|---|---|---|---|---|---|---|
| Y | **WhatsApp publishing** (Status, Channels, groups) | L | Channel connect + composer fields | Same | New adapter + third-party provider (Repliz uses Zawa); per-target scheduling | High: provider contract, Meta policy |
| Z | **Shopee scheduling + third-party OAuth + n8n node** | XL | Shopee connect, OAuth consent screen, n8n docs | Shopee connect only | Shopee adapter; OAuth authorization server; n8n package | High: marketplace API, security review |

### Why this order

- **A–E** touch no platform permissions and mostly read data that already exists. They are the
  cheapest way to make the product feel finished.
- **F–M** each add one contained backend surface. F is the only one in this tier with real
  review risk, because moderation scopes are platform-controlled.
- **N–P** are account and trust work. They unlock agencies more than they unlock features.
- **Q–S** are one project in three parts: the engine, the reusable presets, and the audit log.
  Do not ship Q without S, because "what did the bot do?" is the first support question.
- **T–X** are platform-specific behaviours. Each needs its own permission, event shape and
  failure mode. They are where Repliz has the most accumulated edge cases.
- **Y–Z** are new channels and a partner platform. They are strategically separate from the
  automation roadmap and should not block it.

---

## 6. Recommended sequence

### Wave 1 — finish the product (about 2 weeks)

`A, B, C, D, E, G`

No permissions, no new providers, visible on both surfaces. Ends with comment reporting,
inbox states, a tour, import from Excel, and a retry button.

### Wave 2 — trust and inbox parity (about 4 weeks)

`F, H, I, J, N, O`

Manual moderation, 2FA, a broader API, webhooks, operator logins, device sessions. This is the
wave that makes agencies comfortable.

### Wave 3 — the Repliz-shaped win (about 6–8 weeks)

`Q → R → S`, then `T`, then `K, P`

This is the actual competitive answer: rules engine, templates, audit log, DM automation.
`Q` is the long pole; budget for per-platform permission differences, not just code.

### Wave 4 — expansion (about 8+ weeks, parallel if possible)

`U, V, W, X, L, M, Y`

The AI agent is the best demo per week of work because it reuses services that already exist.
Story replies and Live comments are the most permission-expensive items in the list.

### Do last, or never

`Z`, and the commercial extras (affiliate, coupons, redeem codes, add-ons). They are business
operations, not product differentiators. Revisit only if agency volume justifies them.

---

## 7. Web + mobile implementation notes

Both clients talk to the same Supabase project, so the backend is built once. The UI is built
twice: Next.js components in `apps/web/src/components` and React Native components in
`src/components` / `src/screens`. Budget roughly **40% backend, 30% web, 30% mobile** for
Tier 1–2, and **30/35/35** for Tier 3–4.

Where the shared code should live:

- `packages/core` exists but currently only exports channel ids, and nothing imports it.
  Put pure logic there so web and mobile cannot drift: comment-rule matching (keywords,
  exceptions, exact match), DM window maths, credit metering, plan-limit formatting.
- Keep Supabase queries duplicated rather than abstracted. A shared data layer sounds nice
  and costs more than it saves at this size.
- For rules, the evaluator belongs in the **worker** (it already owns dispatch, retries and
  rate limits), not in an edge function. The edge function should only enqueue.
- Mobile navigation gating for operators should be one map in `src/components/BottomNav.tsx`
  plus a guard in `App.tsx`, not per-screen checks.
- Every new settings surface needs a matching view in `AccountScreen` (`AcctView` union) or it
  will look web-only. That file is the mobile settings spine.

---

## 8. What not to copy

- **One-time billing without auto-renew.** Sosial's subscription model is more predictable.
  This is a positioning decision, not a feature gap.
- **QRIS / Shopee / WhatsApp** unless the target market is Indonesian commerce. That is
  Repliz's wedge, not a universal requirement.
- **Affiliate program.** A growth channel, not a product feature; it needs volume to pay for
  itself.
- **Their information architecture.** Repliz splits Comment, Conversation, Live Content,
  Automation Content, Automation Template, Report and Storage into separate menus. Sosial's
  single Community inbox plus Analytics is cleaner; add capability, not menu count.
