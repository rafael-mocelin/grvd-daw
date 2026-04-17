# GRVD DAW — Deployment Guide

GitHub → Vercel (auto-deploy) + Supabase (auth + database + realtime)

---

## 1. Supabase — create project & run migrations

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Name it `grvd-daw`, pick a region close to your testers, set a strong DB password
3. Once the project is ready, go to **SQL Editor → New query**
4. Open `supabase/migrations/001_initial_schema.sql` from this repo and paste the entire contents into the editor → **Run**
5. Go to **Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`

### Enable email auth
- Go to **Authentication → Providers → Email** → make sure it's **enabled**
- For the prototype you can turn off "Confirm email" so testers don't have to verify → **Authentication → Settings → Email → Confirm email: OFF** (optional)

---

## 2. Local dev — set up env vars

```bash
cp .env.example .env.local
```

Fill in `.env.local`:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Then install dependencies and start dev server:
```bash
npm install
npm run dev
```

---

## 3. GitHub — push the repo

```bash
cd daw-v2

# Create a new repo on github.com first (no README, no .gitignore)
# then run:

git remote add origin https://github.com/YOUR_USERNAME/grvd-daw.git
git add .
git commit -m "feat: initial prototype with Supabase auth + realtime coop"
git push -u origin main
```

After this, every `git push` will auto-trigger a Vercel deploy.

---

## 4. Vercel — connect & configure

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the GitHub repo you just pushed
3. Framework preset: **Vite** (Vercel usually detects this automatically)
4. Build settings (should be auto-detected):
   - Build command: `npm run build`
   - Output directory: `dist`
5. **Environment Variables** — add both:
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
6. Click **Deploy**

That's it. Your app will be live at `https://your-project.vercel.app`.

---

## 5. Workflow after setup

- Edit code locally → `git push` → Vercel auto-deploys (usually ~30s)
- The `vercel.json` at the root handles SPA routing (no 404 on refresh)
- `.env.local` is gitignored — env vars live only in Vercel's dashboard

---

## 6. Supabase Realtime (for Coop sessions)

The Coop feature uses Supabase Realtime broadcast channels. These work out of the box with the anon key — no extra configuration needed. The channel name is `coop:<JOIN_CODE>` so each session is isolated.

---

## 7. Optional: disable email confirmation for faster testing

In Supabase → **Authentication → Settings**:
- Set **"Confirm email"** to **OFF**

This lets testers sign up and immediately play without checking their email.
