// server/export.js
// Dumps the configured week from diary.db into a static JSON snapshot
// (src/diary-data.json) that the deployed, backend-less site reads from.
//
// Usage:  node server/export.js 2026-05-17
//         (pass your WEEK_START Sunday; falls back to the default below)

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { getDb } from './db.js'
import { collapseLoops, buildDayStats, formatHour } from './lastfm.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ← change this default to your week's Sunday, or pass it as an argument
const WEEK_START = process.argv[2] || '2026-05-17'

function buildDayData(db, date) {
  const scrobbles = db.prepare(`SELECT * FROM scrobbles WHERE date=? ORDER BY timestamp ASC`).all(date)
  if (scrobbles.length === 0) {
    return { date, synced: false, scrobbles: [], blocks: [], notes: '', stats: null }
  }
  const collapsed = collapseLoops(scrobbles)
  const stats = buildDayStats(scrobbles, collapsed)
  const blocks = db.prepare(`SELECT * FROM blocks WHERE date=? ORDER BY start_ts ASC`).all(date)
  const notesRow = db.prepare(`SELECT body FROM notes WHERE date=?`).get(date)
  const newArtists = db.prepare(`SELECT DISTINCT artist FROM scrobbles WHERE date=? AND is_new_artist=1`).all(date)
  const newTracks  = db.prepare(`SELECT DISTINCT track, artist FROM scrobbles WHERE date=? AND is_new_track=1`).all(date)
  const newAlbums  = db.prepare(`SELECT DISTINCT album, artist FROM scrobbles WHERE date=? AND is_new_album=1 AND album IS NOT NULL`).all(date)
  return {
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
    notes: notesRow?.body ?? '',
  }
}

function buildWeekSummary(db, startDate) {
  const days = []
  const [y, m, d] = startDate.split('-').map(Number)
  for (let i = 0; i < 7; i++) {
    const dt = new Date(y, m - 1, d + i)
    const dateStr = dt.toISOString().slice(0, 10)

    const emojiRow = db.prepare(`SELECT emoji FROM day_meta WHERE date=?`).get(dateStr)
    const emoji = emojiRow?.emoji ?? null

    const synced = db.prepare(`SELECT * FROM synced_days WHERE date=?`).get(dateStr)
    if (!synced) { days.push({ date: dateStr, synced: false, emoji }); continue }

    const scrobbles = db.prepare(`SELECT * FROM scrobbles WHERE date=?`).all(dateStr)
    if (scrobbles.length === 0) { days.push({ date: dateStr, synced: false, emoji }); continue }

    const stats = buildDayStats(scrobbles, [])
    const newCount = db.prepare(`SELECT COUNT(DISTINCT artist) as n FROM scrobbles WHERE date=? AND is_new_artist=1`).get(dateStr)

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
  return days
}

const db = getDb()
const [y, m, d] = WEEK_START.split('-').map(Number)

const week = buildWeekSummary(db, WEEK_START)
const days = {}
for (let i = 0; i < 7; i++) {
  const dt = new Date(y, m - 1, d + i)
  const dateStr = dt.toISOString().slice(0, 10)
  days[dateStr] = buildDayData(db, dateStr)
}

const out = { weekStart: WEEK_START, week, days }
const outPath = path.join(__dirname, '..', 'src', 'diary-data.json')
fs.writeFileSync(outPath, JSON.stringify(out, null, 2))

const syncedCount = week.filter(dd => dd.synced).length
console.log(`✓ Exported ${WEEK_START} week → src/diary-data.json (${syncedCount}/7 days have data)`)