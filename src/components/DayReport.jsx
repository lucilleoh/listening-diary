import { useState, useEffect } from 'react'
import { format, parseISO, fromUnixTime } from 'date-fns'
import BlockEditor from './BlockEditor'
import NotesEditor from './NotesEditor'

const BLOCK_COLORS = [
  { key: 'amber',  label: 'amber',  hex: '#FAC775' },
  { key: 'blue',   label: 'blue',   hex: '#85B7EB' },
  { key: 'green',  label: 'green',  hex: '#97C459' },
  { key: 'purple', label: 'purple', hex: '#AFA9EC' },
  { key: 'coral',  label: 'coral',  hex: '#F0997B' },
  { key: 'pink',   label: 'pink',   hex: '#ED93B1' },
  { key: 'teal',   label: 'teal',   hex: '#5DCAA5' },
  { key: 'gray',   label: 'gray',   hex: '#B4B2A9' },
]

export const COLOR_HEX = Object.fromEntries(BLOCK_COLORS.map(c => [c.key, c.hex]))

function formatFullDate(dateStr) {
  return format(parseISO(dateStr), 'EEEE, MMMM d, yyyy')
}

// ── Hourly activity bar chart ──────────────────────────────────────────────
function HourlyChart({ scrobbles }) {
  const counts = Array(24).fill(0)
  for (const s of scrobbles) {
    const h = new Date(s.timestamp * 1000).getHours()
    counts[h] += s.play_count ?? 1
  }
  const max = Math.max(...counts, 1)
  const labels = ['12a','1','2','3','4','5','6','7','8','9','10','11','12p','1','2','3','4','5','6','7','8','9','10','11']

  return (
    <div className="hourly-chart">
      <div className="hourly-bars">
        {counts.map((c, h) => (
          <div key={h} className="hourly-col" data-tip={`${labels[h]}: ${c} plays`}>
            <div
              className="hourly-bar"
              style={{ height: `${Math.round((c / max) * 100)}%`, opacity: c === 0 ? 0.12 : 1 }}
            />
            {(h % 3 === 0) && <div className="hourly-label">{labels[h]}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Export / print view ────────────────────────────────────────────────────
function buildExportText(date, stats, scrobbles, blocks, notes) {
  const lines = []
  lines.push(`GEN_MUS 170 — LISTENING DIARY`)
  lines.push(`${formatFullDate(date)}`)
  lines.push(`${'─'.repeat(48)}`)
  lines.push(``)
  lines.push(`DAILY STATS`)
  lines.push(`  Tracks listened:  ${stats.unique_tracks} (${stats.total_scrobbles} total plays)`)
  lines.push(`  Peak hour:        ${stats.peak_hour_label}`)
  lines.push(`  Top track:        ${stats.top_track} — ${stats.top_track_artist} (×${stats.top_track_count})`)
  lines.push(`  Top album:        ${stats.top_album} — ${stats.top_album_artist}`)
  if (stats.new_artists.length > 0) {
    lines.push(`  New artists:      ${stats.new_artists.join(', ')}`)
  }
  if (stats.new_albums.length > 0) {
    lines.push(`  New albums:       ${stats.new_albums.map(a => a.album).join(', ')}`)
  }
  lines.push(``)

  // Group by blocks
  const labeled = []
  const unblocked = []
  for (const s of scrobbles) {
    const b = blocks.find(b => s.timestamp >= b.start_ts && s.timestamp <= b.end_ts)
    if (b) labeled.push({ ...s, blockLabel: b.label })
    else   unblocked.push(s)
  }

  // Print block sections
  const grouped = {}
  for (const s of labeled) {
    if (!grouped[s.blockLabel]) grouped[s.blockLabel] = []
    grouped[s.blockLabel].push(s)
  }
  for (const [label, tracks] of Object.entries(grouped)) {
    lines.push(`[${label.toUpperCase()}]`)
    for (const t of tracks) {
      const time = format(fromUnixTime(t.timestamp), 'h:mm a').toLowerCase()
      const loops = t.play_count > 1 ? ` (×${t.play_count})` : ''
      lines.push(`  ${time}  ${t.track} — ${t.artist}${loops}`)
    }
    lines.push(``)
  }

  if (unblocked.length > 0) {
    lines.push(`[UNLABELED]`)
    for (const t of unblocked) {
      const time = format(fromUnixTime(t.timestamp), 'h:mm a').toLowerCase()
      const loops = t.play_count > 1 ? ` (×${t.play_count})` : ''
      lines.push(`  ${time}  ${t.track} — ${t.artist}${loops}`)
    }
    lines.push(``)
  }

  lines.push(`NOTES`)
  lines.push(notes || '(none)')
  return lines.join('\n')
}

export default function DayReport({ data, date, syncing, onSync, onSaveBlocks, onSaveNotes, readOnly }) {
  const [blocks, setBlocks] = useState([])
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (data) {
      setBlocks(data.blocks ?? [])
      setNotes(data.notes ?? '')
      setNotesSaved(false)
      setShowExport(false)
    }
  }, [data])

  async function handleSaveBlocks(newBlocks) {
    setBlocks(newBlocks)
    await onSaveBlocks(newBlocks)
  }

  async function handleSaveNotes(body) {
    setNotes(body)
    await onSaveNotes(body)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  function handleCopyExport() {
    const text = buildExportText(date, data.stats, data.scrobbles, blocks, notes)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!data) {
    return <div className="day-report day-report--loading"><span className="spinner" />loading...</div>
  }

  if (!data.synced) {
    return (
      <div className="day-report day-report--unsynced">
        <h2>{formatFullDate(date)}</h2>
        <p>no data yet for this day.</p>
        {!readOnly && (
          <button className="btn-primary" onClick={onSync} disabled={syncing}>
            {syncing ? 'syncing…' : '↻ sync from last.fm'}
          </button>
        )}
      </div>
    )
  }

  const { stats, scrobbles } = data

  const scrobblesWithBlocks = scrobbles.map(s => {
    const block = blocks.find(b => s.timestamp >= b.start_ts && s.timestamp <= b.end_ts)
    return { ...s, blockLabel: block?.label, blockColor: block ? COLOR_HEX[block.color_key] : null }
  })

  return (
    <div className="day-report">
      <div className="day-report__header">
        <div>
          <h2>{formatFullDate(date)}</h2>
          <p className="course-sub">GEN_MUS 170 — listening diary</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => setShowExport(!showExport)}>
            {showExport ? '✕ close export' : '↗ export'}
          </button>
          {!readOnly && (
            <button className="btn-ghost" onClick={onSync} disabled={syncing}>
              {syncing ? 'syncing…' : '↻ re-sync'}
            </button>
          )}
        </div>
      </div>

      {/* ── Export panel ── */}
      {showExport && (
        <div className="export-panel">
          <div className="export-panel__header">
            <span className="section-title">plain text export</span>
            <button className="btn-ghost btn-sm" onClick={handleCopyExport}>
              {copied ? '✓ copied!' : 'copy to clipboard'}
            </button>
          </div>
          <pre className="export-pre">{buildExportText(date, stats, scrobbles, blocks, notes)}</pre>
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="stats-grid">
        <StatCard label="tracks" value={stats.unique_tracks} sub={`${stats.total_scrobbles} total plays`} />
        <StatCard label="peak hour" value={stats.peak_hour_label} sub="most active" />
        <StatCard label="top track" value={stats.top_track} sub={`${stats.top_track_artist} · ×${stats.top_track_count}`} small />
        <StatCard label="top album" value={stats.top_album} sub={stats.top_album_artist} small />
        <StatCard
          label="new today"
          value={stats.new_artists.length}
          sub={stats.new_artists.length > 0 ? 'new artists' : 'no new artists'}
          highlight={stats.new_artists.length > 0}
        />
      </div>

      {/* ── Hourly activity chart ── */}
      <HourlyChart scrobbles={scrobbles} />

      {/* ── New discoveries ── */}
      {(stats.new_artists.length > 0 || stats.new_tracks.length > 0 || stats.new_albums.length > 0) && (
        <div className="discoveries">
          <div className="discoveries__label">first listens today ✦</div>
          <div className="discoveries__chips">
            {stats.new_artists.map(a => <span key={a} className="chip chip--artist">{a}</span>)}
            {stats.new_albums.map(a => <span key={a.album + a.artist} className="chip chip--album">{a.album}</span>)}
          </div>
        </div>
      )}

      {/* ── Block editor ── */}
      <BlockEditor
        scrobbles={scrobblesWithBlocks}
        blocks={blocks}
        onSave={handleSaveBlocks}
        readOnly={readOnly}
      />

      {/* ── Notes ── */}
      <NotesEditor
        value={notes}
        onSave={handleSaveNotes}
        readOnly={readOnly}
      />
    </div>
  )
}

function StatCard({ label, value, sub, small, highlight }) {
  return (
    <div className={`stat-card ${highlight ? 'stat-card--highlight' : ''}`}>
      <div className="stat-card__label">{label}</div>
      <div className={`stat-card__value ${small ? 'stat-card__value--sm' : ''}`}>{value}</div>
      <div className="stat-card__sub">{sub}</div>
    </div>
  )
}
