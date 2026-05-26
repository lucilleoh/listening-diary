import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'

// Maps top track → a fun emoji sticker (used as the auto-derived fallback)
const STICKER_MAP = [
  { keywords: ['rage', 'metal', 'hard', 'fire', 'burn'], sticker: '🔥' },
  { keywords: ['sad', 'cry', 'blue', 'rain', 'grey', 'gray', 'grief', 'loss'], sticker: '🌧️' },
  { keywords: ['love', 'heart', 'romance', 'kiss', 'baby', 'darling'], sticker: '💌' },
  { keywords: ['night', 'midnight', 'moon', 'dark', 'dream'], sticker: '🌙' },
  { keywords: ['sun', 'morning', 'light', 'bright', 'day', 'shine'], sticker: '☀️' },
  { keywords: ['dance', 'party', 'disco', 'club', 'dj', 'beat'], sticker: '🪩' },
  { keywords: ['road', 'drive', 'car', 'run', 'highway', 'motion'], sticker: '🚗' },
  { keywords: ['ocean', 'sea', 'wave', 'water', 'tide', 'shore'], sticker: '🌊' },
  { keywords: ['home', 'house', 'room', 'window', 'door'], sticker: '🏠' },
  { keywords: ['ghost', 'haunt', 'dead', 'death', 'gone'], sticker: '👻' },
  { keywords: ['flower', 'bloom', 'rose', 'petal', 'garden'], sticker: '🌸' },
  { keywords: ['star', 'space', 'universe', 'galaxy', 'cosmos'], sticker: '⭐' },
  { keywords: ['fly', 'bird', 'wing', 'sky', 'air', 'cloud'], sticker: '🦋' },
  { keywords: ['winter', 'cold', 'snow', 'freeze', 'ice'], sticker: '❄️' },
  { keywords: ['summer', 'heat', 'warm', 'hot', 'july', 'june'], sticker: '🌴' },
]

export function getSticker(trackName, artistName) {
  const combined = `${trackName} ${artistName}`.toLowerCase()
  for (const { keywords, sticker } of STICKER_MAP) {
    if (keywords.some(k => combined.includes(k))) return sticker
  }
  return '🎵'
}

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const COLOR_ACCENT = {
  0: '#F0997B', // sun - coral
  1: '#5DCAA5', // mon - teal
  2: '#AFA9EC', // tue - purple
  3: '#FAC775', // wed - amber
  4: '#85B7EB', // thu - blue
  5: '#ED93B1', // fri - pink
  6: '#97C459', // sat - green
}

// Curated emoji palette for the picker — 4 rows of 8
const EMOJI_OPTIONS = [
  '🎵', '🎧', '🎸', '🎹', '🥁', '🎤', '🎷', '🪩',
  '☀️', '🌙', '⭐', '✨', '🌈', '❄️', '☁️', '🌧️',
  '🔥', '💌', '💔', '💫', '🌸', '🍷', '💎', '🎀',
  '🌊', '🌴', '🌿', '🦋', '🐚', '🍓', '🌻', '☕',
]

export default function WeekStrip({ days, selectedDate, syncing, loading, onSelectDay, onSyncDay, onUpdateEmoji }) {
  const [pickerOpenFor, setPickerOpenFor] = useState(null)

  // Close picker on any click outside the picker (picker stops propagation itself)
  useEffect(() => {
    if (!pickerOpenFor) return
    const handler = () => setPickerOpenFor(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [pickerOpenFor])

  if (loading) {
    return (
      <div className="week-strip">
        {Array(7).fill(0).map((_, i) => (
          <div key={i} className="day-card day-card--skeleton" />
        ))}
      </div>
    )
  }

  function chooseEmoji(date, emoji) {
    onUpdateEmoji(date, emoji)
    setPickerOpenFor(null)
  }
  function resetEmoji(date) {
    onUpdateEmoji(date, null)
    setPickerOpenFor(null)
  }

  return (
    <div className="week-strip">
      {days.map((day) => {
        const dateObj = parseISO(day.date)
        const dayLabel = DAY_LABELS[dateObj.getDay()]
        const dateNum  = format(dateObj, 'd')
        const monthStr = format(dateObj, 'MMM').toLowerCase()
        const isSelected = selectedDate === day.date
        const isSyncing  = syncing === day.date
        const accent = COLOR_ACCENT[dateObj.getDay()]
        const autoSticker = day.synced ? getSticker(day.top_track ?? '', day.top_track_artist ?? '') : null
        const displaySticker = day.emoji || autoSticker

        return (
          <div
            key={day.date}
            className={`day-card ${isSelected ? 'day-card--selected' : ''} ${day.synced ? 'day-card--synced' : 'day-card--empty'}`}
            style={{ '--accent': accent }}
            onClick={() => day.synced && onSelectDay(day.date)}
          >
            <div className="day-card__header">
              <span className="day-label">{dayLabel}</span>
              <span className="date-num">{dateNum}</span>
              <span className="month-str">{monthStr}</span>
            </div>

            {day.synced ? (
              <>
                <div
                  className="day-card__sticker day-card__sticker--clickable"
                  title="change emoji"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPickerOpenFor(prev => prev === day.date ? null : day.date)
                  }}
                >
                  {displaySticker}
                </div>
                <div className="day-card__top-track" title={`${day.top_track} — ${day.top_track_artist}`}>
                  {day.top_track}
                </div>
                <div className="day-card__meta">
                  <span>{day.total_scrobbles} plays</span>
                  {day.new_artists_count > 0 && (
                    <span className="new-badge">+{day.new_artists_count} new</span>
                  )}
                </div>

                {pickerOpenFor === day.date && (
                  <div className="emoji-picker" onClick={e => e.stopPropagation()}>
                    <div className="emoji-picker__grid">
                      {EMOJI_OPTIONS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          className="emoji-picker__btn"
                          onClick={() => chooseEmoji(day.date, emoji)}
                        >{emoji}</button>
                      ))}
                    </div>
                    {day.emoji && (
                      <button
                        type="button"
                        className="emoji-picker__reset"
                        onClick={() => resetEmoji(day.date)}
                      >reset to auto ({autoSticker})</button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="day-card__empty">
                <button
                  className="sync-btn-small"
                  disabled={isSyncing}
                  onClick={(e) => { e.stopPropagation(); onSyncDay(day.date) }}
                >
                  {isSyncing ? '…' : '↻ sync'}
                </button>
              </div>
            )}

            {day.synced && (
              <button
                className="resync-btn"
                title="re-sync from last.fm"
                disabled={isSyncing}
                onClick={(e) => { e.stopPropagation(); onSyncDay(day.date) }}
              >
                {isSyncing ? '…' : '↻'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}