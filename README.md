# OT-Flow — Deployment Guide (Step by Step)

This is a ready-made project. You don't need to write any code — just follow these steps.

## Part A: Put this code on GitHub

1. Go to https://github.com and sign up / log in.
2. Click the **+** icon (top right) → **New repository**.
3. Name it `ot-flow` → keep it **Public** → click **Create repository**.
4. On the new repo page, click **uploading an existing file** (a blue link in the middle of the page).
5. Unzip the file you downloaded from Claude on your computer, then **drag the entire unzipped folder's contents** (all files and the `src` folder) into the GitHub upload box.
   - Do NOT upload `node_modules` (it won't exist yet anyway).
6. Scroll down, click **Commit changes**.

## Part B: Deploy on Vercel

1. Go to https://vercel.com and sign up using your **GitHub account** (easiest option).
2. Click **Add New... → Project**.
3. Find your `ot-flow` repo in the list → click **Import**.
4. Vercel will auto-detect it's a Vite project. Before clicking Deploy, open **Environment Variables** section and add:
   - `VITE_SUPABASE_URL` → `https://keihsonpodvewaufzbti.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` → your publishable key (starts with `sb_publishable_...`)
5. Click **Deploy**. Wait 1-2 minutes.
6. You'll get a live link like `ot-flow-yourname.vercel.app` — this works from any device, anywhere.

## Part C: Test it

- Open the live link.
- Top-right badge should say **"Live · Supabase"**.
- Try clicking "Advance stage" or toggling consent — then go check your Supabase Table Editor, the data should have changed there too.

## If something breaks

- **Build fails on Vercel**: click into the failed deployment, read the error log, and paste it back to Claude — it can debug it for you.
- **"Live · Supabase" doesn't show / shows connection error**: double check the two Environment Variables in Vercel Project Settings → Environment Variables are spelled exactly `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy (Vercel → Deployments → ... → Redeploy).
- **RLS / permission errors**: make sure you ran the `create policy` SQL block in Supabase SQL Editor (the one enabling public read/write for demo purposes).

## Local testing (optional, only if you install Node.js)

```
npm install
npm run dev
```
Then open the local URL shown in the terminal.
