# listening diary — GEN_MUS 170

A personal listening diary app that pulls your Last.fm scrobbles, lets you annotate them by activity, and keeps a daily reflection log.

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure your Last.fm credentials
```bash
cp .env.example .env
```
Then open `.env` and fill in:
- `LASTFM_API_KEY` — get one free at https://www.last.fm/api/account/create
- `LASTFM_USERNAME` — your Last.fm username

### 3. Set your assignment week
Open `src/App.jsx` and update `WEEK_START` to the Sunday your diary week begins:
```js
const WEEK_START = '2026-04-26'  // ← change this
```

---

## Running the app

You need **two terminals**:

**Terminal 1 — backend (data + Last.fm sync):**
```bash
node server/index.js
```

**Terminal 2 — frontend:**
```bash
npm run dev
```

Then open http://localhost:5173

---

## Daily workflow (~5 mins before bed)

1. Open the app
2. Click **↻ sync** on today's date in the week strip
3. Look over the track list — drag-select ranges and label them (morning routine, lifting, etc.)
4. Write your reflection in the notes box (it autosaves)

---

## How "new" detection works

The first time an artist / album / track appears in your scrobbles, it gets flagged as `new`. This persists across all days in your `diary.db`, so "new artist" means new to *your entire history* since you started using this app — not just new today.

---

## Files

```
listening-diary/
├── server/
│   ├── index.js      ← Express API (run this first)
│   ├── db.js         ← SQLite schema
│   └── lastfm.js     ← Last.fm API + data processing
├── src/
│   ├── App.jsx               ← main app, week state
│   ├── components/
│   │   ├── WeekStrip.jsx     ← 7-day calendar strip with stickers
│   │   ├── DayReport.jsx     ← full day view with stats
│   │   ├── BlockEditor.jsx   ← drag-to-label track blocks
│   │   └── NotesEditor.jsx   ← reflection textarea
│   └── app.css
├── diary.db          ← created automatically on first run
└── .env              ← your credentials (never commit this)
```

---

## Customizing stickers

Open `src/components/WeekStrip.jsx` and edit the `STICKER_MAP` array. Keywords in the track/artist name map to an emoji sticker shown on the day card.
