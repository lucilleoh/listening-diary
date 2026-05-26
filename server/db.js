import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'diary.db')

let db

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    initSchema()
  }
  return db
}

function initSchema() {
  db.exec(`
    -- Every scrobble pulled from last.fm
    CREATE TABLE IF NOT EXISTS scrobbles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT NOT NULL,          -- 'YYYY-MM-DD'
      timestamp   INTEGER NOT NULL,       -- unix seconds
      track       TEXT NOT NULL,
      artist      TEXT NOT NULL,
      album       TEXT,
      mbid        TEXT,                   -- musicbrainz id if available
      is_new_track  INTEGER DEFAULT 0,
      is_new_artist INTEGER DEFAULT 0,
      is_new_album  INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_scrobbles_date ON scrobbles(date);

    -- Tracks grouped into labeled activity blocks by the user
    CREATE TABLE IF NOT EXISTS blocks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT NOT NULL,
      label       TEXT NOT NULL,          -- "morning routine", "lifting", etc.
      color_key   TEXT NOT NULL DEFAULT 'gray', -- amber|blue|green|purple|coral|pink|gray
      start_ts    INTEGER NOT NULL,
      end_ts      INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_blocks_date ON blocks(date);

    -- User's reflection notes per day
    CREATE TABLE IF NOT EXISTS notes (
      date        TEXT PRIMARY KEY,
      body        TEXT NOT NULL DEFAULT ''
    );

    -- Everything ever heard — for "new" detection
    CREATE TABLE IF NOT EXISTS seen_tracks  (track TEXT, artist TEXT, PRIMARY KEY(track, artist));
    CREATE TABLE IF NOT EXISTS seen_artists (artist TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS seen_albums  (album TEXT, artist TEXT, PRIMARY KEY(album, artist));

    -- Metadata about each synced day (so we don't double-pull)
    CREATE TABLE IF NOT EXISTS synced_days (
      date        TEXT PRIMARY KEY,
      synced_at   INTEGER NOT NULL,
      scrobble_count INTEGER NOT NULL DEFAULT 0
    );
  `)
}
