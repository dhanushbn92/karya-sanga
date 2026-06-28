# Karya Sanga — Platform Route Map

> One-sheet reference for every route in the platform. Use it for instructor onboarding, code review, or a "what lives where" lookup.

## Legend

| Symbol | Meaning |
|---|---|
| 🌐 | Public — anyone with the URL |
| 👤 | Signed-in — any authenticated user |
| 🧑‍🎓 | Participant — kids (default role) |
| 🧑‍⚖️ | Judge role |
| 🛠️ | Instructor or Admin role |

---

## Public surfaces

| Route | Who | What it does |
|---|---|---|
| `/` | 🌐 | Landing page — hero with Anaadi badge, workshop modules section, hackathon CTA, newsletter, footer |
| `/login` | 🌐 | Email/password + Google sign-in. Redirects signed-in users to `/dashboard` |
| `/signup` | 🌐 | Name + email + password. Trigger creates `public."User"` row; auto-promote rule applies for `dhanushextra2@gmail.com` |
| `/callback` | 🌐 | Supabase OAuth code → session exchange, then `redirectTo` or `/dashboard` |

---

## Participant surfaces (light "Youth Edition" theme)

### Daily flow

| Route | Who | What it does |
|---|---|---|
| `/dashboard` | 👤 | **Home.** Greeting + "Your next move" CTA + team card + learning progress + saved Wokwi projects + cohort feed + wall preview + explore cards. Admins also see operator chips. |
| `/settings/profile` | 👤 | Edit display name, handle (becomes public URL), bio, age band, "Building now" line, public-visibility toggle, mentor-available toggle |

### Learning

| Route | Who | What it does |
|---|---|---|
| `/lessons` | 👤 | List of published modules + lessons. Progress bar across all lessons. Difficulty pills. |
| `/lessons/[id]` | 👤 | Lesson reader. Sidebar of all lessons in module, markdown body with code highlighting, Mark Complete, Open in Wokwi, **Present**, **View slides deck**, External slides, prev/next |
| `/lessons/[id]/present` | 👤 | **Fullscreen presenter mode.** Dark theme. Keyboard: ←→↑↓ Space PgUp/Dn Home/End F Esc. Slide counter + saffron progress bar |
| `/lessons/[id]/deck` | 👤 | **Fullscreen deck viewer.** PDF inline (browser native). PPT via Office Online (deployed hosts only) |

### Building

| Route | Who | What it does |
|---|---|---|
| `/simulator` | 👤 | **Maker Lab.** Board launchers (ESP32 / S3 / C3 / Arduino UNO / RP2040), instructor-curated starter library, your saved Wokwi projects, save-project form, 9-component reference |
| `/simulator/components/[slug]` | 👤 | Component detail — tagline, paragraph, pins table, wiring steps, "Open a fresh ESP32 / Arduino UNO in Wokwi" CTA, "Find a lesson" |

### Hackathon

| Route | Who | What it does |
|---|---|---|
| `/hackathon` | 👤 | Header with deadline + leaderboard link, your team banner (if any), teams looking for members, create-team form (if solo), "Looking for a team" skills board |
| `/hackathon/teams/[id]` | 👤 (read), member (edit) | **Team workspace.** Project title/description/repo/build-log textarea, Wokwi link list, members panel with captain badge, submission banner, looking-for-members toggle (captain) |
| `/hackathon/teams/[id]/submit` | member | Submission form — title, description, demo video URL, Wokwi URL, repo URL. Deadline-aware. Locks on submit; instructor can unlock |
| `/hackathon/leaderboard` | 👤 (if public) / 🛠️ (always) | Ranked submissions by mean total score across judges (max 40 per judge) |

### Community

| Route | Who | What it does |
|---|---|---|
| `/gallery` | 👤 | **Project Gallery.** Featured hero, cohort + tag filters, grid of project cards |
| `/gallery/[id]` | 👤 (read), member (edit) | Project detail — team panel, links sidebar, story + architecture markdown, **Build log** with composer for team members |
| `/builders` | 👤 | Alumni directory, cohort filter, builder cards with inline badge previews |
| `/builders/[handle]` | 👤 (alumni-only by default; public if author opts in) | Builder profile — name, handle, cohort, age band, bio, "Building now", **badges** grouped by Workshop / Platform, linked project |
| `/cohorts/[id]` | 👤 (member) / 🛠️ (any) | **Cohort space.** Composer (members + admins), pinned + chronological feed, roster, cohort projects |
| `/wall` | 👤 | **Community Wall.** Masonry photo grid, three reactions (👏 ❤️ 💡) per post, comments, **realtime CDC updates** via Supabase Postgres |
| `/wall/new` | 👤 | Upload photo (5 MB max, JPG/PNG/WebP/GIF) with caption + tags. Goes to pending unless approval-config off |
| `/live` | 👤 | Placeholder for future live-video embed |

---

## Instructor / Admin surfaces (dark "Modern Ashram" theme)

| Route | Who | What it does |
|---|---|---|
| `/admin` | 🛠️ | Stats + tile grid: Cohorts, Badges, Modules & lessons, Hackathon ops, Wokwi starters, Wall moderation (with pending-count badges) |
| `/admin/modules` | 🛠️ | List + create modules |
| `/admin/modules/[id]` | 🛠️ | Edit module settings, list/add lessons. **Per lesson**: markdown body (with `---` slide separators), Wokwi URL, external slides URL, PDF/PPT slide upload (50 MB), difficulty, publish |
| `/admin/cohorts` | 🛠️ | List + create cohorts. Only one cohort can be "current" at a time |
| `/admin/cohorts/[id]` | 🛠️ | Cohort settings, roster manager (add unassigned users / remove / move between cohorts), description |
| `/admin/badges` | 🛠️ | Award form (builder + badge slug + optional note). Recently-awarded list with revoke. 17-badge catalog |
| `/admin/simulator/starters` | 🛠️ | Curate Wokwi starter library: label, board, category, URL, order, publish flag |
| `/admin/wall` | 🛠️ | Pending queue with thumbnails, approve / reject (with reason) / delete; recently-approved row; toggle requires-approval config |
| `/admin/hackathon` | 🛠️ | Config (max team size, deadline, leaderboard public), stats, cross-link tiles, submissions table with **lock/unlock** per row |
| `/admin/hackathon/teams` | 🛠️ | **Team formation control.** Create team with member emails, manage rosters, solo placement, **move between teams**, set captain, delete team |
| `/admin/hackathon/judge` | 🧑‍⚖️ + 🛠️ | List of all submissions with **your total** preview per row |
| `/admin/hackathon/judge/[submissionId]` | 🧑‍⚖️ + 🛠️ | Score form — submission details, 4 sliders (innovation / technical / AI use / presentation), comment textarea |

---

## API / internal

| Route | Who | What it does |
|---|---|---|
| `/api/health` | 🌐 | Liveness probe `{ ok: true, ts: <ms> }`. Skipped by auth middleware; cheap |

---

## Top nav (after simplification pass)

| Audience | Items |
|---|---|
| Signed out | **Projects** · **Community** · (Login button) · (Sign Up button) |
| Participant | **Home** · **Lessons** · **Projects** · **Community** |
| Judge (not admin) | + **Judging** |
| Admin / instructor | + **Admin** |

Brand area (left): Anaadi flame-eye mark + "Karya Sanga" wordmark + "An initiative of Anaadi Foundation" subtitle.

Right side: your display name (links to `/settings/profile`) + sign-out button.

---

## Capability lookup — "If a kid wants to…"

| Action | Route |
|---|---|
| Continue a lesson | `/dashboard` → "Continue: …" card or `/lessons/[id]` |
| Save a Wokwi project | `/simulator` → bottom save form |
| Form or join a team | `/hackathon` |
| Submit their team's project | `/hackathon/teams/[id]/submit` |
| See other teams' projects | `/gallery` |
| Look at someone's profile | `/builders/[handle]` |
| Post a photo | `/wall/new` |
| React to a photo | Tap an emoji at `/wall` |
| Comment on a photo | Composer below each card at `/wall` |
| Edit their profile / pick a handle | `/settings/profile` |
| Open their cohort space | `/cohorts/[id]` (linked from Home) |

## Capability lookup — "If an instructor wants to…"

| Action | Route |
|---|---|
| Publish a lesson | `/admin/modules/[id]` → add lesson, check Published |
| Upload a slide deck (PDF/PPT) | `/admin/modules/[id]` → expand a lesson → Upload slides |
| Create a cohort | `/admin/cohorts` → create form |
| Assign a kid to a cohort | `/admin/cohorts/[id]` → "Add member" picker |
| Form a team manually | `/admin/hackathon/teams` → "Create team with members" form |
| Move a kid between teams | `/admin/hackathon/teams` → Move → dropdown on a team member |
| Set the hackathon deadline | `/admin/hackathon` → Settings → Submission deadline |
| Score a submission | `/admin/hackathon/judge/[submissionId]` |
| Make the leaderboard public | `/admin/hackathon` → Settings → Leaderboard public + Save |
| Approve a wall post | `/admin/wall` → Approve button on a pending tile |
| Award a badge | `/admin/badges` → form |
| Curate a Wokwi starter | `/admin/simulator/starters` → Add starter |

---

## Under the hood

| Concern | What we use |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind v4 + shadcn/ui primitives |
| Database | Supabase Postgres in **Mumbai** (`ap-south-1`) — ~36ms RTT from India |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Auth | Supabase Auth (email/password + Google OAuth wiring) |
| File storage | Two private Supabase Storage buckets — `wall-images` (5 MB, JPG/PNG/WebP/GIF), `lesson-slides` (50 MB, PDF/PPT/PPTX) |
| Realtime | Supabase Postgres CDC on `WallPost`, `Reaction`, `Comment` |
| Themes | Light **Youth Edition** (participant pages); dark **Modern Ashram** (admin pages + `/lessons/[id]/present` + `/lessons/[id]/deck`) |

## Database tables (30)

**Auth & profile:** `User`, `Cohort`, `Badge`, `EarnedBadge`

**Learning:** `Module`, `Lesson`, `Progress`, `SavedProject`, `WokwiStarter`

**Hackathon:** `HackathonConfig`, `Team`, `TeamMember`, `TeamWokwiLink`, `LookingForTeam`, `Submission`, `Score`

**Community:** `WallPost`, `Reaction`, `Comment`, `CohortPost`, `BuildLogEntry`

**Alumni platform (data-only, UI pending):** `BlogPost`, `BlogComment`, `TakeItFurtherSession`, `SessionRegistration`, `ShowAndTellEvent`, `ShowAndTellPresenter`, `FeaturedBuilder`

---

## What's NOT built yet

With data layer in place (additive UI only):
- Personal blog composer (Feature 2 from spec)
- Take It Further sessions (Feature 4)
- Show & Tell events (Feature 5)
- Featured Builder of the Month workflow (Feature 6)

No data layer yet:
- Live video integration
- Notifications / email digest
- Global search
- Mobile-specific polish (drawer nav, larger tap targets)
- Accessibility audit
- AI-content moderation policy
- Parental consent flow for under-18s

---

*Updated 2026-05-30 after the simplification pass.*
