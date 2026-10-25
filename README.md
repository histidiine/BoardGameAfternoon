# Board Game Afternoons

A private website for our board game group: one shared shelf of everyone's games, hearts for favorites, stars to vote for the next afternoon, and an archive of past vote pages.

The full specification lives in the group's Claude project ("Board Game Afternoons: Website Specification"). This repository is v1 of that spec.

- **Next.js 16** (App Router, server components and server actions), deployed on **Vercel**
- **Supabase**: Postgres database, magic-link login, row level security
- No password code of our own, no separate backend

## What v1 does

| Page | Path | Who |
| --- | --- | --- |
| The shelf: search, "we will be 6", filters, sort | `/` | everyone |
| Game page: stats, owners, voters, BoardGameGeek and rules video links | `/games/[slug]` | everyone |
| My favorites | `/favorites` | members |
| Next table: podium, ranking, your 5 stars | `/next` | everyone (voting needs an account) |
| Past tables: frozen rankings, games played | `/past`, `/past/[id]` | everyone |
| Log in or join (magic link, invite code the first time) | `/login` | everyone |
| Profile: display name, theme, games I own | `/profile` | members |
| Admin: Excel import, plan an afternoon, close voting, games played, roles, anonymous votes | `/admin` | admins |

Themes A "Cozy evening" (default), B "Game table" and C "Fun fair daylight" are switchable from the palette button. Members keep their choice in their profile; visitors keep it in a cookie.

### Rules the database enforces

These live in `supabase/migrations/`, so no browser or script can get around them:

- At most **5 stars** per member per afternoon (`settings.vote_budget`), one per game.
- Only **one afternoon open** for voting at a time.
- Voting **closes at the deadline**: stars can no longer be added or removed, and the page moves to Past tables.
- Members change only their own name, theme, hearts and stars. Games, copies, afternoons and roles are admin-only.
- The group always keeps **at least one admin**.
- An Excel import runs in **one transaction**: if one row breaks a rule, nothing is changed.
- With **anonymous votes** switched on, other members' names are hidden from everyone except admins.

## Setting it up (about 30 minutes)

### 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) (the free plan is enough for a few dozen members) and create a project. Pick a European region, for example Zurich or Frankfurt.
2. Open **SQL Editor**, paste the whole content of `supabase/migrations/20261025100000_initial_schema.sql`, and run it.
   - If you use the Supabase CLI instead: `npx supabase link --project-ref <your-ref>` then `npx supabase db push`.
3. Do **not** run `supabase/seed.sql` on this project. It holds sample games and people for local testing only.

### 2. Configure login

In the Supabase dashboard:

1. **Authentication > Sign In / Providers**: keep **Email** enabled and turn **off** "Allow new users to sign up". New people join through the site's login page, which checks the invite code first.
2. **Authentication > URL Configuration**: set **Site URL** to the site's address (for example `https://board-game-afternoons.vercel.app`) and add `http://localhost:3000/**` to **Redirect URLs** for local work.
3. **Authentication > Emails > Magic Link**: replace the link in the template with

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Log in to Board Game Afternoons</a>
   ```

   With this link, people can ask for the email on a laptop and open it on their phone. (The default template also works, but only in the browser that asked for the link.)
4. **Authentication > Emails > SMTP Settings**: connect a real email sender (Resend, Brevo, Postmark and others have free tiers). Supabase's built-in sender is meant for testing: it only sends a few emails per hour and may only deliver to members of your Supabase team.

### 3. Run it on your computer

```bash
cp .env.example .env.local   # then fill in the values below
npm install
npm run dev                  # http://localhost:3000
```

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings > API Keys > Publishable key |
| `SUPABASE_SECRET_KEY` | Project Settings > API Keys > Secret key. Server only, never share it. |
| `INVITE_CODE` | Any word you share in the group chat. Needed the first time someone joins. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally, the real address in production |
| `NEXT_PUBLIC_TIME_ZONE` | Optional. Defaults to `Europe/Zurich`. |

### 4. First login and the games list

1. Open `/login`, choose "First time here?", and enter your email, your display name and the invite code. **The first person to log in becomes admin.**
2. Go to **Admin > Load games from Excel**. The template columns are listed there (Name, Owner, Min players, Max players, Duration (min), Type are required). One row per copy: if two people own Azul, it appears twice.
3. Owners in the file appear as members right away. When a friend later joins with **the same display name**, the games under that name become theirs. Ask friends to use exactly the name written in the file.
4. **Admin > Plan the next afternoon** opens voting.

### 5. Put it online with Vercel

1. Push this folder to a GitHub repository.
2. On [vercel.com](https://vercel.com), import the repository (the defaults for Next.js are right).
3. Add the same environment variables, with `NEXT_PUBLIC_SITE_URL` set to the Vercel address.
4. Back in Supabase, set **Site URL** to that same address.

## Trying it with sample data

With Docker running, the Supabase CLI starts a full local copy and loads the sample games, people and past afternoons from `supabase/seed.sql`:

```bash
npx supabase init          # once; keeps the existing migrations folder
npx supabase start
npx supabase db reset      # applies the migration, then the seed
```

Use the local URL and keys that `supabase start` prints in `.env.local`. Log in as "Aurélie" (any email, invite code from your `.env.local`) to claim the sample shelf and become admin.

## Project layout

```
supabase/migrations/   database schema, voting rules, access rules, import function
supabase/seed.sql      sample data for local testing only
src/app/               pages and server actions (one folder per page)
src/app/admin/         admin page, its panels and actions
src/components/        game card, shelf filters, heart and star buttons, mascot, icons
src/lib/data.ts        all database reads
src/lib/domain.ts      shared types, labels and date formatting
src/lib/import.ts      Excel row validation, shared by preview and import
src/proxy.ts           keeps the login session fresh
```

## Not in v1 yet

- **v2:** members add and remove their own copies with BoardGameGeek search. Needs a registered BGG application, so apply early.
- Deleting your own account. The spec says it should remove favorites and anonymise past votes; for now an admin can delete a person in Supabase.
- Personal theme colors, French/English switch, RSVP and email reminders, as listed under "Later ideas" in the spec.
- Pictures: v1 shows the image links from the Excel file as they are. Check that each site allows this before relying on it.
