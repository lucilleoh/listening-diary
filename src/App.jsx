import { useState, useEffect } from 'react'
import { parseISO, addDays, format } from 'date-fns'
import WeekStrip from './components/WeekStrip'
import DayReport from './components/DayReport'
import diaryData from './diary-data.json'
import './app.css'

// GEN_MUS 170 — 7-day listening diary
// Week starts Sunday May 17, 2026
const WEEK_START = '2026-05-17'

// In a production build (deployed to Vercel) there's no backend, so we read
// the frozen snapshot in diary-data.json. In dev (npm run dev) we use the
// live API so you can keep syncing/editing.
const STATIC = import.meta.env.PROD

function weekRangeLabel(startStr) {
  const start = parseISO(startStr)
  const end   = addDays(start, 6)
  // e.g. "May 3 – 9"
  if (format(start, 'MMMM yyyy') === format(end, 'MMMM yyyy')) {
    return `${format(start, 'MMMM d')} – ${format(end, 'd, yyyy')}`
  }
  return `${format(start, 'MMMM d')} – ${format(end, 'MMMM d, yyyy')}`
}

export default function App() {
  const [weekData, setWeekData] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [dayData, setDayData] = useState(null)
  const [syncing, setSyncing] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWeek()
  }, [])

  async function loadWeek() {
    setLoading(true)
    if (STATIC) {
      setWeekData(diaryData.week)
      setLoading(false)
      return
    }
    const res = await fetch(`/api/week/${WEEK_START}`)
    const data = await res.json()
    setWeekData(data)
    setLoading(false)
  }

  async function loadDay(date) {
    setSelectedDate(date)
    setDayData(null)
    if (STATIC) {
      setDayData(diaryData.days[date] ?? { date, synced: false, scrobbles: [], blocks: [], notes: '', stats: null })
      return
    }
    const res = await fetch(`/api/day/${date}`)
    const data = await res.json()
    setDayData(data)
  }

  async function syncDay(date) {
    if (STATIC) return
    setSyncing(date)
    try {
      const res = await fetch(`/api/sync/${date}`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        console.error('Sync failed:', data)
        alert(`Sync failed: ${data.error || 'unknown error'}`)
        return
      }

      console.log('Sync result:', data)

      await loadWeek()
      await loadDay(date)
    } catch (err) {
      console.error('Sync crashed:', err)
      alert(`Sync crashed: ${err.message}`)
    } finally {
      setSyncing(null)
    }
  }

  async function updateEmoji(date, emoji) {
    if (STATIC) return
    // Optimistic update so the UI feels instant
    setWeekData(prev => prev.map(d => d.date === date ? { ...d, emoji } : d))
    try {
      await fetch('/api/emoji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, emoji })
      })
    } catch (err) {
      console.error('Emoji save failed:', err)
      // If the save failed, refetch to get back to truth
      await loadWeek()
    }
  }

  async function saveBlocks(date, blocks) {
    if (STATIC) return
    await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, blocks })
    })
  }

  async function saveNotes(date, body) {
    if (STATIC) return
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, body })
    })
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-left">
          <h1>listening diary</h1>
          <span className="course-tag">GEN_MUS 170</span>
        </div>
        <div className="header-right">
          <span className="week-label">week of {weekRangeLabel(WEEK_START)}</span>
        </div>
      </header>

      <WeekStrip
        days={weekData}
        selectedDate={selectedDate}
        syncing={syncing}
        loading={loading}
        onSelectDay={loadDay}
        onSyncDay={syncDay}
        onUpdateEmoji={updateEmoji}
        readOnly={STATIC}
      />

      {selectedDate && (
        <DayReport
          data={dayData}
          date={selectedDate}
          syncing={syncing === selectedDate}
          onSync={() => syncDay(selectedDate)}
          onSaveBlocks={(blocks) => saveBlocks(selectedDate, blocks)}
          onSaveNotes={(body) => saveNotes(selectedDate, body)}
          readOnly={STATIC}
        />
      )}

      {!selectedDate && (
        <div className="empty-state">
          <p>click a day to load your listening report</p>
        </div>
      )}
    </div>
  )
}