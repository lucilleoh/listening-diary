import { useState } from 'react'
import { format, fromUnixTime } from 'date-fns'
import { COLOR_HEX } from './DayReport'
import ColorPicker from './ColorPicker'

const PRESET_LABELS = [
  'morning routine', 'breakfast', 'commute', 'class', 'study / reading',
  'lifting', 'cardio', 'walk', 'cooking', 'cleaning', 'winding down',
  'background', 'intentional listen', 'other'
]

const BLOCK_COLORS = [
  { key: 'coral',  hex: '#F0997B' },
  { key: 'green',  hex: '#97C459' },
  { key: 'teal',   hex: '#5DCAA5' },
  { key: 'blue',   hex: '#85B7EB' },
  { key: 'purple', hex: '#AFA9EC' },
  { key: 'pink',   hex: '#ED93B1' },
]

function resolveColor(key) {
  if (!key) return COLOR_HEX.gray
  if (key.startsWith('#')) return key
  return COLOR_HEX[key]
}

function fmtTime(unix) {
  return format(fromUnixTime(unix), 'h:mmaaa')
}

function buildSegments(scrobbles, blocks) {
  if (!scrobbles.length) return []
  const sorted = [...blocks].sort((a, b) => a.start_ts - b.start_ts)
  const segments = []
  let i = 0
  while (i < scrobbles.length) {
    const s = scrobbles[i]
    const block = sorted.find(b => s.timestamp >= b.start_ts && s.timestamp <= b.end_ts)
    if (block) {
      const tracks = scrobbles.filter(t => t.timestamp >= block.start_ts && t.timestamp <= block.end_ts)
      segments.push({ type: 'block', block, tracks })
      const next = scrobbles.findIndex(t => t.timestamp > block.end_ts)
      i = next === -1 ? scrobbles.length : next
    } else {
      const tracks = []
      while (i < scrobbles.length) {
        const t = scrobbles[i]
        if (sorted.find(b => t.timestamp >= b.start_ts && t.timestamp <= b.end_ts)) break
        tracks.push(t)
        i++
      }
      if (tracks.length) segments.push({ type: 'unlabeled', tracks })
    }
  }
  return segments
}

function TrackRow({ s, state, onClick, onMouseEnter }) {
  const cls = {
    normal:      'track-row',
    selecting:   'track-row track-row--selectable',
    start:       'track-row track-row--start',
    highlighted: 'track-row track-row--selecting',
    end:         'track-row track-row--start',
  }[state] ?? 'track-row'

  return (
    <div className={cls} onClick={onClick} onMouseEnter={onMouseEnter}>
      <span className="tr-time">{fmtTime(s.timestamp)}</span>
      <div className="tr-info">
        <span className="tr-name">{s.track}</span>
        {s.is_new_track ? <span className="new-tag">new</span> : null}
        <span className="tr-artist">{s.artist}</span>
        {s.album ? <span className="tr-album">· {s.album}</span> : null}
      </div>
      {s.play_count > 1 && <span className="tr-loops">×{s.play_count}</span>}
    </div>
  )
}

const PREVIEW_COUNT = 3

function BlockCard({ block, tracks, getRowState, onTrackClick, onTrackHover, onEdit, onRemove, readOnly }) {
  const [expanded, setExpanded] = useState(false)
  const hex = resolveColor(block.color_key)
  const hasMore = tracks.length > PREVIEW_COUNT
  const visible = expanded ? tracks : tracks.slice(0, PREVIEW_COUNT)
  const hidden = tracks.length - PREVIEW_COUNT

  return (
    <div className="block-card" style={{ '--block-color': hex }}>
      <div className="block-card__header">
        <div className="block-card__left">
          <span className="block-card__dot" />
          <span className="block-card__label">{block.label}</span>
          <span className="block-card__time">{fmtTime(block.start_ts)} – {fmtTime(block.end_ts)}</span>
        </div>
        <div className="block-card__right">
          <span className="block-card__count">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
          {!readOnly && (
            <>
              <button className="block-edit" onClick={onEdit} title="edit block">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </button>
              <button className="legend-remove" onClick={onRemove} title="remove block">×</button>
            </>
          )}
        </div>
      </div>
      <div className="block-card__tracks">
        {visible.map((s, ti) => (
          <TrackRow
            key={ti}
            s={s}
            state={getRowState(s)}
            onClick={() => onTrackClick(s)}
            onMouseEnter={() => onTrackHover(s)}
          />
        ))}
        {hasMore && (
          <div className="block-collapse-row" onClick={() => setExpanded(e => !e)}>
            <span className="block-collapse-label">
              {expanded ? `hide ${hidden} tracks` : `${hidden} more track${hidden !== 1 ? 's' : ''}`}
            </span>
            <span className="block-collapse-arrow">{expanded ? '∧' : '∨'}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BlockEditor({ scrobbles, blocks, onSave, readOnly }) {
  const [selecting, setSelecting]   = useState(false)
  const [firstTs, setFirstTs]       = useState(null)
  const [secondTs, setSecondTs]     = useState(null)
  const [hoveredTs, setHoveredTs]   = useState(null)
  const [labelInput, setLabelInput] = useState('morning routine')
  const [colorKey, setColorKey]     = useState('coral')
  const [showModal, setShowModal]   = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [editingBlock, setEditingBlock] = useState(null)

  function startSelecting() {
    setSelecting(true); setFirstTs(null); setSecondTs(null); setHoveredTs(null)
  }
  function cancelSelecting() {
    setSelecting(false); setFirstTs(null); setSecondTs(null); setHoveredTs(null)
  }

  function handleTrackClick(s) {
    if (!selecting) return
    if (firstTs === null) {
      setFirstTs(s.timestamp)
    } else {
      setSecondTs(s.timestamp)
      setShowModal(true)
    }
  }

  function handleTrackHover(s) {
    if (selecting && firstTs !== null && secondTs === null) {
      setHoveredTs(s.timestamp)
    }
  }

  // Open the modal pre-filled to edit an existing block's label/color
  function startEditBlock(block) {
    setEditingBlock(block)
    setLabelInput(block.label)
    setColorKey(block.color_key)
    setShowPicker(false)
    setShowModal(true)
  }

  function confirmBlock() {
    if (editingBlock) {
      // Update the existing block in place (keeps its time range)
      const updated = blocks.map(b =>
        b === editingBlock ? { ...b, label: labelInput, color_key: colorKey } : b
      )
      onSave(updated)
    } else {
      // Create a brand-new block from the selected range
      const start = Math.min(firstTs, secondTs ?? firstTs)
      const end   = Math.max(firstTs, secondTs ?? firstTs)
      const updated = [...blocks, { label: labelInput, color_key: colorKey, start_ts: start, end_ts: end }]
        .sort((a, b) => a.start_ts - b.start_ts)
      onSave(updated)
    }
    closeModal()
    cancelSelecting()
  }

  function closeModal() {
    setShowModal(false)
    setShowPicker(false)
    setEditingBlock(null)
    setHoveredTs(null)
  }

  function removeBlock(blockToRemove) {
    onSave(blocks.filter(b => b !== blockToRemove))
  }

  function getRowState(s) {
    if (!selecting) return 'normal'
    if (firstTs === null) return 'selecting'
    const endTs = secondTs ?? hoveredTs ?? firstTs
    const min = Math.min(firstTs, endTs)
    const max = Math.max(firstTs, endTs)
    if (s.timestamp === firstTs) return 'start'
    if (s.timestamp === secondTs) return 'end'
    if (s.timestamp > min && s.timestamp < max) return 'highlighted'
    return 'selecting'
  }

  const segments = buildSegments(scrobbles, blocks)
  const hint = firstTs === null ? 'click the first track in your block' : 'now click the last track in your block'
  const isCustomColor = colorKey?.startsWith('#')

  return (
    <div className="block-editor">
      <div className="section-header">
        <div className="section-title">timeline</div>
        {!readOnly && (selecting
          ? <button className="btn-ghost btn-sm btn-active" onClick={cancelSelecting}>✕ cancel</button>
          : <button className="btn-ghost btn-sm" onClick={startSelecting}>+ label a block</button>
        )}
      </div>

      {selecting && <div className="select-hint">{hint}</div>}

      <div className="segments">
        {segments.map((seg, si) => {
          if (seg.type === 'block') {
            return (
              <BlockCard
                key={si}
                block={seg.block}
                tracks={seg.tracks}
                getRowState={getRowState}
                onTrackClick={handleTrackClick}
                onTrackHover={handleTrackHover}
                onEdit={() => startEditBlock(seg.block)}
                onRemove={() => removeBlock(seg.block)}
                readOnly={readOnly}
              />
            )
          }
          return (
            <div key={si} className="unlabeled-run">
              {seg.tracks.map((s, ti) => (
                <TrackRow
                  key={ti}
                  s={s}
                  state={getRowState(s)}
                  onClick={() => handleTrackClick(s)}
                  onMouseEnter={() => handleTrackHover(s)}
                />
              ))}
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {showPicker ? (
              <ColorPicker
                initialColor={isCustomColor ? colorKey : (COLOR_HEX[colorKey] ?? '#FAC775')}
                onCancel={() => setShowPicker(false)}
                onConfirm={hex => {
                  setColorKey(hex)
                  setShowPicker(false)
                }}
              />
            ) : (
              <>
                <div className="modal-title">{editingBlock ? 'edit block' : 'label this block'}</div>
                <select className="modal-select" value={labelInput} onChange={e => setLabelInput(e.target.value)}>
                  {PRESET_LABELS.map(l => <option key={l}>{l}</option>)}
                </select>
                <input
                  className="modal-input"
                  placeholder="or type your own…"
                  value={labelInput}
                  onChange={e => setLabelInput(e.target.value)}
                />
                <div className="color-picker">
                  {BLOCK_COLORS.map(c => (
                    <button key={c.key}
                      type="button"
                      className={`color-dot ${colorKey === c.key ? 'color-dot--selected' : ''}`}
                      style={{ background: c.hex }}
                      onClick={() => setColorKey(c.key)}
                    />
                  ))}
                  <button
                    type="button"
                    className={`color-dot ${isCustomColor ? 'color-dot--selected' : ''}`}
                    style={
                      isCustomColor
                        ? { background: colorKey }
                        : { background: 'conic-gradient(from 0deg, #ff5b5b, #ffd24a, #6ee05c, #4ad9c5, #5fa3ff, #c46bff, #ff5b9e, #ff5b5b)' }
                    }
                    onClick={() => setShowPicker(true)}
                    title="custom color"
                  />
                </div>
                <div className="modal-actions">
                  <button className="btn-ghost" onClick={closeModal}>cancel</button>
                  <button className="btn-primary" onClick={confirmBlock}>
                    {editingBlock ? 'save changes' : 'save block'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
