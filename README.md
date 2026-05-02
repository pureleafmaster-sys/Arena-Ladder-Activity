# Arena Ladder Activity

Full Next.js + Supabase + Blizzard API build.

## Upload to GitHub

Upload the contents of this folder so the repo root contains:

```text
app/
components/
lib/
supabase/
package.json
vercel.json
```

## Supabase

Run `supabase/schema.sql` in Supabase SQL Editor.

## Vercel env vars

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
BLIZZARD_CLIENT_ID=xxx
BLIZZARD_CLIENT_SECRET=xxx
BLIZZARD_REGION=us
BLIZZARD_NAMESPACE=dynamic-classic-us
BLIZZARD_LOCALE=en_US
CRON_SECRET=somethingLikeMySecret12345
MIN_RATING=2100
POLL_BRACKETS=3v3,5v5
```

Leave `BLIZZARD_PVP_SEASON_ID` blank until you call:

```text
https://YOUR-SITE.vercel.app/api/cron/discover-season?secret=somethingLikeMySecret12345
```

Then set `BLIZZARD_PVP_SEASON_ID` and redeploy.

## First poll

```text
https://YOUR-SITE.vercel.app/api/cron/poll?secret=somethingLikeMySecret12345
```
