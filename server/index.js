import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

import express from 'express'
import cors from 'cors'
import { getDb } from './db.js'
import {
  fetchDayScrobbles,
  collapseLoops,
  buildDayStats,
  formatHour,
  backfillFromLastfm,
} from './lastfm.js'

const app = express()
app.use(cors())
app.use(express.json())

// ─── ONE-TIME MIGRATION ──────────────────────────────────────────────────
;(function migrate() {
  const db = getDb()
  // Add first_seen_date to seen_* if missing
  for (const tbl of ['seen_artists', 'seen_tracks', 'seen_albums']) {
    const cols = db.prepare(`PRAGMA table_info(${tbl})`).all()
    if (!cols.find(c => c.name === 'first_seen_date')) {
      db.exec(`ALTER TABLE ${tbl} ADD COLUMN first_seen_date TEXT NOT NULL DEFAULT ''`)
      console.log(`migrated: added first_seen_date to ${tbl}`)
    }
  }
  // Custom day-level metadata (emoji override, room to grow)
  db.exec(`
    CREATE TABLE IF NOT EXISTS day_meta (
      date  TEXT PRIMARY KEY,
      emoji TEXT
    )
  `)
})()

// ─── SYNC ────────────────────────────────────────────────────────────────
app.post('/api/sync/:date', async (req, res) => {
  const { date } = req.params
  const db = getDb()

  try {
    const raw = await fetchDayScrobbles(date)
    if (raw.length === 0) return res.json({ message: 'No scrobbles found for this date.', count: 0 })

    const insertScrobble = db.prepare(`
      INSERT OR IGNORE INTO scrobbles
        (date, timestamp, track, artist, album, mbid, is_new_track, is_new_artist, is_new_album)
      VALUES (?,?,?,?,?,?,?,?,?)
    `)

    const insertSeenArtist = db.prepare(`INSERT OR IGNORE INTO seen_artists (artist, first_seen_date) VALUES (?, ?)`)
    const insertSeenTrack  = db.prepare(`INSERT OR IGNORE INTO seen_tracks  (track, artist, first_seen_date) VALUES (?, ?, ?)`)
    const insertSeenAlbum  = db.prepare(`INSERT OR IGNORE INTO seen_albums  (album, artist, first_seen_date) VALUES (?, ?, ?)`)

    const checkArtist = db.prepare(`SELECT 1 FROM seen_artists WHERE artist=? AND first_seen_date<?`)
    const checkTrack  = db.prepare(`SELECT 1 FROM seen_tracks  WHERE track=? AND artist=? AND first_seen_date<?`)
    const checkAlbum  = db.prepare(`SELECT 1 FROM seen_albums  WHERE album=? AND artist=? AND first_seen_date<?`)

    db.prepare(`DELETE FROM scrobbles WHERE date=?`).run(date)

    const syncAll = db.transaction(() => {
      for (const s of raw) {
        const isNewArtist = !checkArtist.get(s.artist, date) ? 1 : 0
        const isNewTrack  = !checkTrack.get(s.track, s.artist, date) ? 1 : 0
        const isNewAlbum  = s.album && !checkAlbum.get(s.album, s.artist, date) ? 1 : 0

        insertScrobble.run(
          date, s.timestamp, s.track, s.artist, s.album, s.mbid,
          isNewTrack, isNewArtist, isNewAlbum ? 1 : 0
        )

        insertSeenArtist.run(s.artist, date)
        insertSeenTrack.run(s.track, s.artist, date)
        if (s.album) insertSeenAlbum.run(s.album, s.artist, date)
      }
    })

    syncAll()

    db.prepare(`
      INSERT OR REPLACE INTO synced_days (date, synced_at, scrobble_count)
      VALUES (?, ?, ?)
    `).run(date, Date.now(), raw.length)

    res.json({ message: 'Synced!', count: raw.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ─── BACKFILL ────────────────────────────────────────────────────────────
app.post('/api/backfill', async (req, res) => {
  const db = getDb()
  try {
    const { artists, tracks, albums } = await backfillFromLastfm()

    const insArtist = db.prepare(`INSERT OR IGNORE INTO seen_artists (artist, first_seen_date) VALUES (?, '')`)
    const insTrack  = db.prepare(`INSERT OR IGNORE INTO seen_tracks  (track, artist, first_seen_date) VALUES (?, ?, '')`)
    const insAlbum  = db.prepare(`INSERT OR IGNORE INTO seen_albums  (album, artist, first_seen_date) VALUES (?, ?, '')`)

    const tx = db.transaction(() => {
      for (const a of artists) insArtist.run(a)
      for (const t of tracks)  insTrack.run(t.name, t.artist)
      for (const a of albums)  insAlbum.run(a.name, a.artist)
    })
    tx()

    res.json({
      ok: true,
      message: 'Backfill complete. Re-sync each day to recompute new flags.',
      artists: artists.length,
      tracks:  tracks.length,
      albums:  albums.length,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ─── EMOJI ───────────────────────────────────────────────────────────────
app.post('/api/emoji', (req, res) => {
  const { date, emoji } = req.body
  const db = getDb()
  if (!emoji) {
    db.prepare(`DELETE FROM day_meta WHERE date=?`).run(date)
  } else {
    db.prepare(`INSERT OR REPLACE INTO day_meta (date, emoji) VALUES (?, ?)`).run(date, emoji)
  }
  res.json({ ok: true })
})

// ─── GET DAY ─────────────────────────────────────────────────────────────
app.get('/api/day/:date', (req, res) => {
  const { date } = req.params
  const db = getDb()

  const scrobbles = db.prepare(`
    SELECT * FROM scrobbles WHERE date=? ORDER BY timestamp ASC
  `).all(date)

  if (scrobbles.length === 0) {
    return res.json({ date, synced: false, scrobbles: [], blocks: [], notes: '', stats: null })
  }

  const collapsed = collapseLoops(scrobbles)
  const stats = buildDayStats(scrobbles, collapsed)

  const blocks = db.prepare(`SELECT * FROM blocks WHERE date=? ORDER BY start_ts ASC`).all(date)
  const notesRow = db.prepare(`SELECT body FROM notes WHERE date=?`).get(date)

  const newArtists = db.prepare(`SELECT DISTINCT artist FROM scrobbles WHERE date=? AND is_new_artist=1`).all(date)
  const newTracks  = db.prepare(`SELECT DISTINCT track, artist FROM scrobbles WHERE date=? AND is_new_track=1`).all(date)
  const newAlbums  = db.prepare(`SELECT DISTINCT album, artist FROM scrobbles WHERE date=? AND is_new_album=1 AND album IS NOT NULL`).all(date)

  res.json({
    date,
    synced: true,
    stats: {
      ...stats,
      peak_hour_label: formatHour(stats.peak_hour),
      new_artists: newArtists.map(r => r.artist),
      new_tracks: newTracks,
      new_albums: newAlbums,
    },
    scrobbles: collapsed,
    blocks,
    notes: notesRow?.body ?? ''
  })
})

// ─── GET WEEK ────────────────────────────────────────────────────────────
app.get('/api/week/:startDate', (req, res) => {
  const { startDate } = req.params
  const db = getDb()

  const days = []
  const [y, m, d] = startDate.split('-').map(Number)

  for (let i = 0; i < 7; i++) {
    const dt = new Date(y, m - 1, d + i)
    const dateStr = dt.toISOString().slice(0, 10)

    const emojiRow = db.prepare(`SELECT emoji FROM day_meta WHERE date=?`).get(dateStr)
    const emoji = emojiRow?.emoji ?? null

    const synced = db.prepare(`SELECT * FROM synced_days WHERE date=?`).get(dateStr)
    if (!synced) {
      days.push({ date: dateStr, synced: false, emoji })
      continue
    }

    const scrobbles = db.prepare(`SELECT * FROM scrobbles WHERE date=?`).all(dateStr)
    if (scrobbles.length === 0) {
      days.push({ date: dateStr, synced: false, emoji })
      continue
    }

    const stats = buildDayStats(scrobbles, [])
    const newCount = db.prepare(`
      SELECT COUNT(DISTINCT artist) as n
      FROM scrobbles WHERE date=? AND is_new_artist=1
    `).get(dateStr)

    days.push({
      date: dateStr,
      synced: true,
      total_scrobbles: scrobbles.length,
      top_track: stats.top_track,
      top_track_artist: stats.top_track_artist,
      top_track_count: stats.top_track_count,
      top_album: stats.top_album,
      peak_hour_label: formatHour(stats.peak_hour),
      new_artists_count: newCount?.n ?? 0,
      emoji,
    })
  }

  res.json(days)
})

// ─── BLOCKS ──────────────────────────────────────────────────────────────
app.post('/api/blocks', (req, res) => {
  const { date, blocks } = req.body
  const db = getDb()

  db.prepare(`DELETE FROM blocks WHERE date=?`).run(date)

  const insert = db.prepare(`
    INSERT INTO blocks (date, label, color_key, start_ts, end_ts)
    VALUES (?, ?, ?, ?, ?)
  `)

  const insertAll = db.transaction(() => {
    for (const b of blocks) {
      insert.run(date, b.label, b.color_key, b.start_ts, b.end_ts)
    }
  })

  insertAll()
  res.json({ ok: true })
})

// ─── NOTES ───────────────────────────────────────────────────────────────
app.post('/api/notes', (req, res) => {
  const { date, body } = req.body
  getDb().prepare(`
    INSERT OR REPLACE INTO notes (date, body) VALUES (?,?)
  `).run(date, body)

  res.json({ ok: true })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () =>
  console.log(`🎵 Listening Diary server running at http://localhost:${PORT}`)
)