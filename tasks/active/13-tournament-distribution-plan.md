# 13 — Tournament Distribution Plan

## Goal
Drive meaningful traffic to the live bracket tracker during the March 2026 tournament with a simple distribution plan that fits the product:
- prioritize channels that reward live sports updates
- avoid time-wasting launches in communities likely to remove self-promo
- frame the project in a way that survives HN skepticism about low-effort AI builds
- turn each game result into a shareable stat artifact that pulls users back to the site

## Constraints
- Optimize for traffic during a short live-event window, not generic long-tail startup marketing.
- Keep the plan executable by one person during active games.
- Do not depend on paid acquisition.
- Avoid posting patterns that look like Reddit spam or HN marketing.
- Lead with useful stats and live updates, not "please check out my project" asks.
- If AI usage comes up, answer truthfully without making "built with AI" the headline.
- Preserve focus on the current product instead of spending tournament time on broad growth experiments.

## Acceptance Criteria
- There is a clear priority order for launch/distribution channels.
- There is a concrete posting plan for before games, during games, and after a traffic spike.
- There is a concrete HN plan including title, framing, and comment strategy.
- There is a concrete Reddit plan including where not to post and the one conditionally viable path.
- There are reusable copy angles for real-time posts.
- There is a short measurement loop tied to existing analytics.

## Current Status
- Research completed on March 19, 2026.
- Current conclusion:
  - primary channels should be X, Threads, and Bluesky
  - Hacker News is worth one well-framed `Show HN`
  - Reddit should be used selectively, not as a broad cross-post channel
- Current product hook is strong enough to market without rewriting the core idea:
  - "I generated 1 billion March Madness brackets"
  - live remaining-perfect count
  - deterministic bracket IDs with on-demand reconstruction
- No code changes are required to start executing this plan.

## Strategy Summary
This product should be distributed as a live stats feed, not as a generic startup launch.

The homepage is the destination, but the shareable unit is the stat:
- a major upset killed `X` brackets
- only `Y` brackets remain perfect
- this game was the biggest bracket killer so far
- your bracket ID is now dead/alive

The best channels are the ones that reward fast, event-driven posting. The site should be linked from those updates, not pitched in isolation.

## Channel Priority

### 1. X, Threads, Bluesky
Use these as the main traffic engine.

Why:
- sports discussion is real-time
- the site updates are naturally tied to game outcomes
- the same stat can be reposted in slightly different packaging across all three
- these platforms are better fits for "live number + link" than Reddit or Product Hunt

Execution:
- post immediately after notable finals, especially upsets
- use one clean stat card plus one sentence plus link
- keep each post self-contained so reshares still make sense
- prefer speed over polish once templates exist

Default post formula:
`[Winner] over [Loser] just killed [X] of my 1,000,000,000 deterministic March Madness brackets. [Y] are still perfect: [link]`

Recommended content types:
- upset kill-shot posts
- "only X remain" milestone posts
- one short explainer thread about how deterministic bracket IDs work
- one "check your bracket ID" style post during high-traffic windows

Platform-specific notes:
- Threads: include relevant topics because topic-tagged posts get broader distribution
- Bluesky: use `#cbb`
- X: keep the first line sharp enough to stand alone in quote-posts and screenshots

### 2. Hacker News
Do one `Show HN` post, not repeated submissions.

Why it can work:
- the project has a real technical hook
- there is an interactive public site with no signup wall
- the deterministic bracket generation angle is more interesting than a generic bracket app

Why it can fail:
- sports by itself is weak HN bait
- anything that feels quickly generated, over-marketed, or AI-smoothed will get punished

Recommended title:
`Show HN: I generated 1B deterministic March Madness brackets`

Recommended post framing:
- what the site does in one sentence
- why the brackets are deterministic
- why they are reconstructed instead of stored
- how live results collapse the remaining perfect-bracket count
- one concrete implementation detail worth discussing

Comment strategy:
- answer technical questions directly
- be specific about tradeoffs and limitations
- do not use AI-generated or AI-polished replies
- do not lead with "I built this with AI"
- if asked, answer plainly: AI helped with implementation, but the idea and core system design are yours

### 3. Reddit
Treat Reddit as selective and defensive.

Do not:
- blast the same link across multiple subs
- post directly to `r/CollegeBasketball` as a self-promotional link
- post to `r/InternetIsBeautiful`

Conditional yes:
- `r/dataisbeautiful` only if you post a real visualization first, with proper `[OC]` source/tool disclosure

Best Reddit use:
- turn one update into a chart or visualization
- make the chart the content and the site the supporting link
- only try this after the site already has a clean stat/card worth sharing

Low-priority Reddit use:
- maker/side-project subs for feedback, not for meaningful tournament traffic

### 4. Direct Outreach
Use this only after you have one good stat card and one clear site screenshot.

Targets:
- college basketball writers
- sports-data accounts
- newsletter writers who like niche interactive projects

Pitch format:
- one sentence
- one stat
- one image
- one link

Do not send a long founder story.

## Messaging Rules

### Lead With The Stat, Not The Build Story
Bad:
- "I made a website"
- "I used AI to build this"
- "please check out my project"

Good:
- "[Team] over [Team] just killed 412,883,294 brackets"
- "Only 9,821 perfect brackets remain"
- "This is the biggest bracket killer so far"

### Keep The AI Answer Ready But Secondary
If someone asks whether AI was involved, use a short truthful answer:

`Yes. I used AI heavily in implementation, but the core idea, bracket generation scheme, and analysis logic are mine.`

Do not make that the headline. On HN especially, the problem is not AI by itself; the problem is sounding low-effort or fake.

### Write Like A Human
Especially on HN:
- no hype language
- no brand voice
- no canned gratitude
- no vague "happy to answer questions" filler if you are not actually answering questions

## Assets To Prepare Today

### Asset 1: Upset Stat Card
Fields:
- winner
- loser
- brackets eliminated
- brackets remaining
- site URL

### Asset 2: Milestone Card
Examples:
- `Only 100,000 remain`
- `Only 10,000 remain`
- `Only 1,000 remain`

### Asset 3: Explainer Graphic
Simple concept:
- bracket IDs run from `0` to `999,999,999`
- each ID seeds a deterministic PRNG
- the bracket is reconstructed on demand

### Asset 4: HN Draft
Prepare:
- title
- 2 to 4 sentence body
- answers for obvious questions:
  - why deterministic
  - why one billion
  - why not store brackets
  - how fast analysis runs
  - what model drives picks

### Asset 5: Reddit-Ready Chart
Only if time permits.

Concepts:
- bracket survival curve by completed game
- biggest bracket-killer games ranked
- percentage of 1 billion still alive after each result

## Tournament-Day Plan

### Before Games
1. Prepare 3 stat-card templates so only numbers and team names need editing.
2. Draft one explainer post/thread for X, Threads, and Bluesky.
3. Draft the `Show HN` post and keep it ready.
4. Confirm Cloudflare analytics is visible so referrals can be checked later.

### During Games
1. Do not post every final.
2. Post:
   - major upsets
   - big bracket-killer games
   - milestone-count drops
3. Aim to post within minutes of the site updating.
4. Reuse the same core stat across X, Threads, and Bluesky with small wording changes.

### After The First Real Spike
1. Check Cloudflare analytics for top referrers and top landing pages.
2. If HN or one social platform is breaking out, spend time replying there instead of posting elsewhere.
3. If a visualization-worthy stat emerges, prepare the `r/dataisbeautiful` version instead of spraying more link posts.

## Suggested Copy

### Social Post 1
`[Winner] over [Loser] just killed [X] of my 1,000,000,000 deterministic March Madness brackets. [Y] are still perfect: [link]`

### Social Post 2
`Only [Y] of 1,000,000,000 brackets are still perfect. Live tracker: [link]`

### Social Post 3
`The biggest bracket killer so far is [Winner] over [Loser]: [X] eliminated. Live count: [link]`

### HN Body Draft
`I built a live tracker for 1 billion deterministic March Madness brackets. Each bracket ID is just a seed; the bracket is reconstructed on demand instead of stored. As real results come in, the site recomputes how many of those 1 billion are still perfect and shows which games killed the most brackets.`

## What Not To Do
- Do not spend time on Product Hunt during the tournament.
- Do not cross-post the same Reddit link widely.
- Do not make AI the marketing hook.
- Do not post the site cold without a concrete stat attached.
- Do not burn time polishing a giant launch thread when a sharp real-time stat post will do better.

## Measurement

### Primary Metrics
- total visits during tournament windows
- referrers by platform
- top landing pages
- whether traffic arrives in spikes after specific posts

### Success Thresholds
Practical signs this is working:
- one platform clearly outperforms the others
- a single post drives a visible referral spike
- at least one post gets reposted/quoted because the stat itself is interesting

### Review Loop
After each posting window:
1. note which post was used
2. note the result/game attached to it
3. check Cloudflare analytics 10 to 30 minutes later
4. repeat the winning format, not the losing one

## Next Steps
- Prepare the three stat-card templates before the next game window.
- Draft and save the `Show HN` submission text.
- Draft one explainer thread for X, Threads, and Bluesky.
- Only attempt Reddit after there is a chart-worthy visualization.
- If traffic starts to move, consider a small product follow-up:
  - stronger social preview image
  - easier bracket-ID sharing
  - simple "share this result" CTA

## Affected Files
- `tasks/active/13-tournament-distribution-plan.md`
- `tasks/active/10-cloudflare-analytics.md`
- `app/page.tsx`
- `app/layout.tsx`
