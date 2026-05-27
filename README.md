# listening diary — GEN_MUS 170

A personal listening diary app that pulls your scrobbles, lets you annotate them by activity, and keeps a daily reflection log.

> **Live version:** [listening-diary.vercel.app](https://listening-diary.vercel.app) — a read-only snapshot of my diary week. (See [section 7](#7-publishing-your-diary-online) for how the live site is built and deployed!)

This guide assumes **zero coding experience**. If a step seems obvious to you, skip it. If you've never opened a terminal before, follow along exactly and you'll be fine :]

---

## Contents

1. [What you'll need](#1-what-youll-need)
2. [Getting the project onto your computer](#2-getting-the-project-onto-your-computer)
3. [Setup](#3-setup)
4. [Running the app](#4-running-the-app)
5. [First time only: backfill your history](#5-first-time-only-backfill-your-history)
6. [Your daily workflow](#6-your-daily-workflow)
7. [Publishing your diary online](#7-publishing-your-diary-online)
8. [How "new" detection works](#8-how-new-detection-works)
9. [Troubleshooting](#9-troubleshooting)
10. [Project files](#10-project-files)
11. [Customizing](#11-customizing)

---

## 1. What you'll need

Four things to set up before the app will run. Take them one at a time.

### a. A code editor (IDE)

This is the program you'll open the project in. If you don't already have one, download either:

- **Cursor** — https://cursor.com (recommended; it has AI built in)
- **VS Code** — https://code.visualstudio.com (the classic, also great)

Install it like any other app. Either one works identically for this guide.

### b. Node.js

Node is what actually runs the app's code on your computer. The app won't work without it.

1. Go to https://nodejs.org
2. Download the **LTS** version (the big green button on the left — "LTS" means the stable one)
3. Run the installer, click through with all the defaults
4. To confirm it worked: open your editor, open a terminal inside it (see [section 4](#4-running-the-app) for how), type this and press Enter:
   ```bash
   node --version
   ```
   If you see a version number like `v20.11.0`, you're good. If it says "command not found," restart your editor and try again.

### c. A Last.fm account, connected to Spotify

Last.fm is a free service that quietly logs every song you play (this is called "scrobbling"). This app reads that log. You connect it to Spotify so your listening gets tracked automatically.

1. **Make a Last.fm account** at https://www.last.fm/join (free)
2. **Connect Spotify:** go to https://www.last.fm/settings/applications, find **Spotify**, and click **Connect**. Log into Spotify when prompted and allow access.
3. That's it — from now on, anything you play on Spotify automatically shows up in your Last.fm history.

> **Important:** scrobbling only logs songs you play *after* connecting. For your diary week to have data, Spotify needs to be connected the whole week, and you need to actually listen to music (a track has to play for ~30 seconds / half its length to count). If you connect it today, today is when your data starts.

### d. A Last.fm API key

This is a password-like code that lets the app read *your* scrobbles. Free and takes a minute.

1. Go to https://www.last.fm/api/account/create
2. Fill in **Application name** (anything works, e.g. `my listening diary`). You can leave the other fields (description, callback URL, homepage) blank.
3. Submit. The next page shows your **API key** — a long string of letters and numbers. Copy it somewhere safe; you'll paste it in [section 3](#3-setup).

> Keep this key private. Don't post it anywhere public or share it.

---

## 2. Getting the project onto your computer

If you were given a link to the project on GitHub:

1. On the GitHub page, click the green **Code** button → **Download ZIP**
2. Unzip the downloaded file (double-click it). You'll get a folder called something like `listening-diary`.
3. In your editor: **File → Open Folder** → select that `listening-diary` folder.

You should now see the project's files listed in a sidebar on the left.

---

## 3. Setup

All the commands below get typed into the **terminal** inside your editor. If you don't have a terminal open yet, jump to [section 4](#4-running-the-app) to learn how, then come back.

### a. Install dependencies

This downloads all the code libraries the app depends on. Run it once:

```bash
npm install
```

It'll churn for a minute and create a `node_modules` folder. That's normal.

### b. Add your Last.fm credentials

First, make your own copy of the example settings file:

```bash
cp .env.example .env
```

Then in the editor's sidebar, open the new file called `.env` and fill in the two values:

```
LASTFM_API_KEY=paste_your_api_key_here
LASTFM_USERNAME=your_lastfm_username
```

- `LASTFM_API_KEY` — the key you copied in [section 1d](#d-a-lastfm-api-key)
- `LASTFM_USERNAME` — your Last.fm username (what's in your profile URL, e.g. `lucilleoh`)

Save the file.

### c. Set your assignment week

In the sidebar, open `src/App.jsx`. Near the top, find this line and change the date to the **Sunday** your diary week begins:

```js
const WEEK_START = '2026-05-17'  // ← change this to your week's Sunday
```

Save the file.

---

## 4. Running the app

The app has two parts that run at the same time, so you need **two terminals** open.

**Opening a terminal in your editor:** go to the top menu → **Terminal → New Terminal** (or press `` Ctrl+` ``, the backtick key above Tab). A panel opens at the bottom — that's your terminal. To open a second one, click the **+** icon in that panel, or do Terminal → New Terminal again.

**Terminal 1 — the backend** (handles data and talks to Last.fm):

```bash
node server/index.js
```

Leave it running. It should print `🎵 Listening Diary server running at http://localhost:3001`.

**Terminal 2 — the frontend** (the actual webpage you look at):

```bash
npm run dev
```

This prints a link, usually **http://localhost:5173** (it may say 5174 or 5175 if 5173 is busy). Hold Cmd (Mac) or Ctrl (Windows) and click the link, or copy it into your browser.

You should see the listening diary. Leave both terminals running while you use the app.

> Whenever you're done, click into each terminal and press `Ctrl+C` to stop the servers.

---

## 5. First time only: backfill your history

By default the app would think *every* song is brand new, because it doesn't know your listening history yet. This one-time step teaches it what you've listened to over the years.

With the backend running (Terminal 1), open a **third** terminal (the first two are busy running the servers) and run:

```bash
curl -X POST http://localhost:3001/api/backfill
```

It takes a few seconds and prints something like `{"ok":true,"artists":1000,"tracks":1000,...}`. After it finishes, click **↻ sync** on each day in the app so the "new" tags recalculate. You only ever need to do this once.

---

## 6. Your daily workflow

About 5 minutes before bed:

1. Open the app (both terminals running)
2. Click **↻ sync** on today's date in the week strip — this pulls the day's listening from Last.fm
3. Look over the track list. To label a stretch of songs as an activity: **click the first track**, then **click the last track** in that stretch. A box pops up where you name it (morning routine, lifting, etc.) and pick a color. Use the rainbow swatch for any custom color.
   - Edit a label later with the **wrench** icon on the block; remove it with the **×**.
4. (Optional) Click the emoji on a day card to pick a custom one — otherwise it auto-picks based on your top track.
5. Write your reflection in the notes box. It autosaves as you type, or hit **save** to be sure.

---

## 7. Publishing your diary online

> Optional. If you only want to run the diary on your own machine, you can skip this section — everything above is all you need. This explains how the **live version** at the top of this README is built.

The live site is a **frozen, read-only snapshot** of a diary week. It has no backend and no database — it can't sync, save, or edit. That's on purpose: it's just a viewer anyone can open with a link, while the editable version stays on your computer.

Here's how it works and how to publish updates.

### How it's wired

- **Locally** (`npm run dev`), the app talks to your live backend, so you can sync and edit as normal.
- **In the published build**, the app reads a bundled snapshot file (`src/diary-data.json`) instead, and all the edit controls are hidden.

The app figures out which mode it's in automatically (it checks whether it's a production build), so you don't toggle anything — local stays fully editable, the deployed site stays read-only.

### Step 1 — export a snapshot

Once your diary week is filled in and looking how you want, freeze it into the snapshot file. From a terminal (the backend doesn't need to be running for this — it reads the database directly), run:

```bash
node server/export.js 2026-05-17
```

Pass your own `WEEK_START` Sunday in place of `2026-05-17`. It writes `src/diary-data.json` and prints how many of the 7 days have data. **Re-run this whenever you update your diary** and want the live site to reflect the change.

### Step 2 — push to GitHub

The snapshot has to be committed so the deploy can see it:

```bash
git add -A
git status                 # sanity check: should NOT list .env or diary.db
git commit -m "update diary snapshot"
git push
```

> **Heads up on privacy:** `diary-data.json` contains your stats *and your written reflections*, and committing it to a public repo (and deploying it) makes that text publicly viewable to anyone with the link. That's expected for a submitted assignment — just know it's public before you push.

### Step 3 — deploy on Vercel

[Vercel](https://vercel.com) hosts the live site for free.

- **First time:** sign in with GitHub → **Add New → Project** → import your `listening-diary` repo → it auto-detects Vite, so leave the defaults → **Deploy**. You'll get a URL like `your-project.vercel.app`. No environment variables are needed (the published build reads the JSON, not the Last.fm API).
- **Every time after:** just `git push`. Vercel automatically rebuilds and redeploys. You only need to re-export (Step 1) if the *data* changed; for code or styling changes, a push is enough.

> Tip: before pushing, you can preview the published version locally with `npm run build` then `npm run preview` — open that with your backend **off** to confirm the read-only snapshot looks right.

---

## 8. How "new" detection works

When you sync a day, each artist / track / album is checked against a record of the **first date** you ever encountered it. It's flagged `new` only if it's never appeared on an earlier date.

That record gets filled two ways:

1. The **backfill** (section 5) seeds it with your Last.fm top ~1000 artists/tracks/albums, marked as "seen long ago" — so your established favorites never wrongly show as new.
2. **Each sync** adds that day's listening, stamped with the day's date.

So **"new artist" means new to your listening history**, not just new to today — and genuinely-new discoveries still surface correctly even if you re-sync a day multiple times.

To start fresh, delete the `diary.db` file and re-run the backfill + re-sync.

---

## 9. Troubleshooting

**`command not found: node` (or `npm`)**
Node isn't installed, or the terminal hasn't picked it up yet. Re-check [section 1b](#b-nodejs), then fully quit and reopen your editor.

**`npm install` errors out**
Make sure you opened the actual project folder (the one containing `package.json`) in your editor, and that you're running the command from that folder.

**The page loads but there's no data / sync does nothing**
- Is Terminal 1 (`node server/index.js`) still running? The frontend can't get data without it.
- Double-check `.env`: the API key and username must be correct, with no extra spaces. After editing `.env`, restart the backend (`Ctrl+C` in Terminal 1, then `node server/index.js` again).

**"No scrobbles found for this date"**
Either you didn't listen to music that day, Spotify wasn't connected to Last.fm yet, or the username in `.env` is wrong. Check your history is showing up at `last.fm/user/YOUR_USERNAME`.

**Everything shows as "new"**
You haven't run the backfill yet — see [section 5](#5-first-time-only-backfill-your-history) — or you ran it but haven't re-synced the days.

**`port already in use` / `EADDRINUSE`**
An old server is still running from before. Quit it: on Mac/Linux run `lsof -ti:3001 | xargs kill` (for the backend) in a spare terminal, or just restart your computer.

**The backfill curl "hangs" or fails**
Make sure the backend (Terminal 1) is actually running first, and that you're running the curl in a *separate* terminal.

**The deployed (Vercel) site is blank or has no data**
You probably didn't run the export, or `src/diary-data.json` wasn't committed. Run `node server/export.js <your-sunday>`, then `git add -A && git commit && git push`. See [section 7](#7-publishing-your-diary-online).

---

## 10. Project files

```
listening-diary/
├── server/
│   ├── index.js      ← the backend API (run this first); sync, backfill, emoji, blocks, notes
│   ├── db.js         ← database schema
│   ├── lastfm.js     ← Last.fm API calls + data processing
│   └── export.js     ← freezes a week into src/diary-data.json for the live site
├── src/
│   ├── App.jsx               ← main app; uses the backend locally, the snapshot when deployed
│   ├── diary-data.json       ← frozen snapshot the published site reads (created by export.js)
│   ├── components/
│   │   ├── WeekStrip.jsx     ← the 7-day strip with stickers + emoji picker
│   │   ├── DayReport.jsx     ← full day view with stats + hourly chart
│   │   ├── BlockEditor.jsx   ← click-to-label activity blocks
│   │   ├── ColorPicker.jsx   ← custom color picker (hue/sat, hex, RGB, eyedropper)
│   │   └── NotesEditor.jsx   ← reflection box (autosave + save button)
│   └── app.css               ← all the styling
├── diary.db          ← your data; created automatically on first run (never committed)
├── .env              ← your private credentials (never share or post this)
├── .env.example      ← the template you copy to make .env
└── .gitignore        ← keeps .env, diary.db, node_modules, etc. out of the repo
```

### Database tables (inside `diary.db`)

- `scrobbles` — every synced play, with new-artist/track/album flags
- `seen_artists` / `seen_tracks` / `seen_albums` — first-seen records that power new detection
- `synced_days` — which days have been synced
- `blocks` — your labeled activity ranges
- `notes` — your daily reflections
- `day_meta` — per-day extras (currently the custom emoji)

---

## 11. Customizing

You can tweak these by opening the file in your editor and editing the lists near the top — no deep coding required.

**Auto-stickers** — `src/components/WeekStrip.jsx`, the `STICKER_MAP` array. Keywords in a song/artist name map to an emoji. (Only used when you haven't manually picked an emoji for that day.)

**Emoji picker choices** — also `WeekStrip.jsx`, the `EMOJI_OPTIONS` array. These are the emojis in the click-to-pick grid.

**Block label suggestions & preset colors** — `src/components/BlockEditor.jsx`, the `PRESET_LABELS` and `BLOCK_COLORS` arrays. The rainbow swatch always opens the full color picker no matter what.
