# Yukti AI Labs — workshop platform

Web platform for the Yukti AI Labs workshop, an initiative of **Anaadi Foundation**. Teaches kids to combine AI with ESP32 electronics, runs a hackathon, hosts a community photo wall, and delivers lessons. Built with Next.js 16 (App Router), TypeScript, Tailwind v4, Supabase (auth + Postgres + storage + realtime), Prisma, and shadcn/ui. Deploy target: Vercel.

## Prerequisites

- Node 22.22+ or 24.15+ (current dev: 24.12 works, but `npm` warns; bump if you can).
- A free Supabase project: <https://supabase.com>.
- Two Anaadi Foundation logo files — see the **Brand assets** section below.

## Brand assets

The app references two logo files from `public/`. **Drop them in before running:**

- `public/anaadi-logo-mark.png` — the flame-eye symbol alone (used in the top nav, auth pages, hero badge, favicon).
- `public/anaadi-logo-full.jpg` (or `.png`) — the "Anaadi Foundation" wordmark with the mark (used in the landing footer). If you swap the extension, also update `src="/anaadi-logo-full.jpg"` in `app/page.tsx`.

PNG with a transparent background is preferred so the mark works in both the light Youth Edition and the dark Modern Ashram themes. SVG also works — just rename the references in code with a find-replace.

## First-time setup

### 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Note the **project ref** (e.g. `abcd1234`) and the database password you set.
3. From **Project settings → API**, grab:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose)
4. From **Project settings → Database → Connection string**, grab the pooled and direct URLs (see `.env.local.example`).

### 2. Configure env vars

```bash
cp .env.local.example .env.local
# Fill in the values from step 1.
```

### 3. Apply the database schema

```bash
npx prisma generate
npx prisma migrate dev --name init
```

This creates the `User` table and `Role` enum in your Supabase database.

### 4. Install the auth → user sync trigger

After the migration above runs, open the **Supabase SQL editor** and paste the contents of [`prisma/triggers.sql`](prisma/triggers.sql). Run it once. From then on, every new Supabase auth user gets a matching `public."User"` row with the default `participant` role.

### 4b. Apply the step-2 migration (Modules / Lessons / Progress)

The Phase 1 step 2 features (lessons authoring + viewer) need three more tables. Paste [`prisma/migrations/0002_modules_lessons_progress.sql`](prisma/migrations/0002_modules_lessons_progress.sql) into the Supabase SQL editor and run it.

To promote someone to `admin` or `instructor`, run this in the SQL editor:

```sql
update public."User" set role = 'admin' where email = 'you@example.com';
```

### 5. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>.

## Deploying to Cloudflare Workers

Deploy via `@opennextjs/cloudflare`. The platform uses **`prisma db push`**
for schema sync (idempotent — no-op when the database already matches),
so deploys are: build → sync schema → deploy worker.

### One-time setup

1. **Bump the Supabase JWT TTL** (because we removed the Node-runtime
   session-refresh proxy that Next.js 16 forces):

   - Supabase dashboard → Project → Authentication → Sessions → **"JWT
     expiry"** → set to **28800** (8 hours, one workshop day). Default
     was 3600 (1 hour) — too short without a refresh middleware.

2. **Create a Cloudflare Worker**:

   - Cloudflare dashboard → **Workers & Pages** → **Create application**
     → **Connect to Git** → pick this repo

3. **Set the build command** (Cloudflare's UI):

   ```
   npm run cf:build
   ```

   And the **deploy command**:

   ```
   npm run cf:deploy
   ```

4. **Add the six environment variables** (Cloudflare dashboard → Settings
   → Variables → Add):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your Supabase publishable key |
   | `SUPABASE_SECRET_KEY` | your Supabase secret key |
   | `DATABASE_URL` | pooled (port 6543) connection string |
   | `DIRECT_URL` | direct (port 5432) connection string |
   | `NEXT_PUBLIC_SITE_URL` | your `*.workers.dev` URL (or custom domain) |

5. **Deploy**: click **Save and Deploy**. The first build takes ~2 minutes
   (subsequent builds are faster thanks to Cloudflare's cache).

### Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | Local Next.js dev server (standard Next 16) |
| `npm run cf:build` | Build for the Workers runtime (Linux only — see below) |
| `npm run cf:preview` | Run the built Worker locally via wrangler |
| `npm run cf:deploy` | Deploy directly from CLI (skips the Git integration) |
| `npm run cf:dryrun` | Dry-run a deploy to check bundle size against the 10 MB limit |
| `npm run db:sync` | Generate Prisma client + push schema (manual sync) |
| `npm run db:baseline` | Regenerate `prisma/SCHEMA_BASELINE.sql` |

### Local building on Windows

`npm run cf:build` uses `next build` + OpenNext's file tracer, which
creates symlinks. On Windows that needs either:

- **Developer Mode** (Settings → Privacy & Security → For developers →
  Developer Mode = On), **or**
- Run from **WSL** (Ubuntu), **or**
- Just use Cloudflare's Git integration — their build runs on Linux, no
  Windows config needed. **Recommended.**

### Manual CLI deploy (alternative to Git)

```bash
# One-time
npx wrangler login
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL       # paste value when prompted
npx wrangler secret put NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put DATABASE_URL
npx wrangler secret put DIRECT_URL
npx wrangler secret put NEXT_PUBLIC_SITE_URL

# Each deploy
npm run cf:build
npm run cf:deploy
```

### Local secrets for `wrangler dev`

Copy `.dev.vars.example` → `.dev.vars` (git-ignored) and fill in the same
values as `.env.local`. Then `npm run cf:preview` runs the actual Worker
locally with those secrets.

### Bootstrapping a brand-new Supabase project

`prisma/SCHEMA_BASELINE.sql` is the full schema as a single SQL script
(every CREATE TABLE / INDEX / FK / ENUM). Paste it into the Supabase SQL
editor on a clean DB, or just let `cf:build` do it via `db push` on the
first deploy.

### Architectural note: no session-refresh middleware

Cloudflare Workers via OpenNext doesn't yet support Next.js 16's
Node-runtime `proxy.ts`, so we removed it. Auth still gates every page
via `requireUser()`, but the proactive cookie refresh is gone — that's
why you bump the Supabase JWT TTL to 8h in step 1. Users sign in at the
start of the workshop day and stay signed in.

## Project layout

```
/app
  /(auth)/login         email sign-in
  /(auth)/signup        email sign-up
  /(auth)/callback      OAuth code → session exchange
  /dashboard            authenticated landing
  /admin                admin/instructor only
  /lessons/[id]         placeholder (next step)
  /simulator            placeholder (next step)
  /hackathon            placeholder (phase 2)
  /wall                 placeholder (phase 2)
  /live                 placeholder (later)
/components             UI primitives + auth forms + top nav
/lib/supabase           browser, server, and proxy-time Supabase clients
/lib/auth.ts            getCurrentUser, requireUser, requireRole
/lib/prisma.ts          Prisma client singleton
/prisma/schema.prisma   data model (Phase 1 subset only)
/prisma/triggers.sql    auth.users → public.User trigger
/proxy.ts               Next.js 16 root proxy (was middleware in v15)
```

## How auth and role gating work

- Browser-side: `lib/supabase/client.ts` creates a Supabase client backed by cookies; used in login/signup/sign-out forms.
- Server-side: `lib/supabase/server.ts` reads session cookies via `next/headers`.
- `proxy.ts` runs on every request, refreshes the Supabase session cookie, and redirects unauthenticated users away from gated paths.
- Server pages additionally call `requireUser()` or `requireRole([...])` from `lib/auth.ts`. **Never rely on the proxy alone** — server-side role checks are the source of truth for privileged actions.
- `getCurrentUser()` joins the Supabase session with the Prisma `User` row. If the trigger hasn't been installed yet, it falls back to upserting a row so the app stays usable; install the trigger for the canonical path.

## Verifying Phase 1 step 1

- `npm run dev` boots cleanly on `localhost:3000`.
- `/` renders the landing page; nav shows Sign in / Sign up.
- Sign up with email; you receive a confirmation email (or, if Supabase **Confirm email** is off, you're auto-signed-in).
- `/dashboard` shows your name + role `participant`.
- A row exists in `public."User"` with that user's id.
- `/admin` redirects you to `/dashboard` while you're a participant. Promote yourself in SQL, sign out and back in, then `/admin` works.
- Hitting `/dashboard` while signed out redirects you to `/login?redirectTo=/dashboard`.

## What's next

- **Step 2 (DONE):** modules, lessons, progress, markdown lesson bodies, Wokwi links as open-in-tab buttons. Authoring at `/admin/modules`, participant view at `/lessons`.
- **Step 3 (DONE):** `/simulator` with 9-component reference (ESP32, breadboard, jumper wires, LED, resistor, push button, buzzer, HC-SR04, soil moisture), per-component detail pages at `/simulator/components/[slug]`, save-Wokwi-project-to-account flow. All Wokwi links open in a new tab — no iframe (per ToS).

## Phase 2 status

- **Hackathon (DONE):** team formation, "looking for team" board, per-team workspace, Wokwi link list, submission flow (deadline-aware), judging with 4-criteria scoring (1–10), leaderboard with public/private toggle, instructor ops at `/admin/hackathon`.
- **Photo wall (DONE):** private Supabase Storage bucket `wall-images`, image upload (5 MB max; JPG/PNG/WebP/GIF), masonry gallery at `/wall`, moderation queue at `/admin/wall`, three reactions (clap / love / idea) with optimistic UI, threaded comments, **realtime CDC updates** across cohort via Supabase Realtime.

### Photo wall — first-time setup

After the Prisma migration runs, you also need the Supabase Storage bucket + RLS policies:

```bash
node scripts/setup-wall-storage.mjs
```

This is idempotent and uses `SUPABASE_SECRET_KEY` from `.env.local` to create the bucket and grant authenticated users upload/delete access scoped to their own folder.

Then enable RLS + realtime publication for reactions/comments:

```bash
node scripts/apply-wall-realtime.mjs
```

This script enables RLS on `WallPost`, `Reaction`, `Comment` (with `authenticated`-role SELECT policies) and adds those tables to Supabase's `supabase_realtime` publication so browser clients receive Postgres CDC events. Prisma still bypasses RLS via the `postgres` superuser role, so server actions work unchanged.

### Lesson slides — first-time setup

For uploading PDF/PPT slide decks per lesson:

```bash
node scripts/setup-lesson-slides-storage.mjs
```

This creates a private `lesson-slides` bucket (50 MB cap, PDF/PPT/PPTX only) and adds RLS so authenticated users can upload to their own `<userId>/...` folder. Reads happen via server-minted signed URLs.

**PDF rendering** works inline anywhere (browsers ship a PDF viewer). **PPT/PPTX preview** uses Microsoft's Office Online viewer, which fetches the file from its own servers — that means PPT previews work on deployed sites but **not on `localhost`**. Upload converts to PDF if you need inline previews during local dev.
- **Phase 2:** hackathon (teams, submissions, judging) and the photo wall (private bucket, signed URLs, Realtime reactions).

## Open items

- **Wokwi licensing** — free-tier ToS restricts to personal non-commercial use. Step 3 will treat Wokwi links as "open in new tab" buttons by default; if the workshop is paid, contact Wokwi about a Classroom subscription before launch.
