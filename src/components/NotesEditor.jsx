import { useState, useEffect, useRef } from 'react'

const PROMPTS = [
  'what did you listen to intentionally vs. just as background?',
  'did anything surprise you about what came up today?',
  'any new artists or tracks worth noting?',
  'how did the music fit the activity you were doing?',
  'anything you want to revisit or explore more?',
]

export default function NotesEditor({ value, onSave }) {
  const [text, setText] = useState(value ?? '')
  const [status, setStatus] = useState('saved') // 'saved' | 'unsaved' | 'saving'
  const timerRef = useRef(null)

  // Sync incoming value when the day changes
  useEffect(() => {
    setText(value ?? '')
    setStatus('saved')
  }, [value])

  async function doSave(body) {
    clearTimeout(timerRef.current)
    setStatus('saving')
    try {
      await onSave(body)
      setStatus('saved')
    } catch {
      setStatus('unsaved')
    }
  }

  function handleChange(e) {
    const v = e.target.value
    setText(v)
    setStatus('unsaved')
    clearTimeout(timerRef.current)
    // autosave after 1.5s of no typing
    timerRef.current = setTimeout(() => doSave(v), 1500)
  }

  function handleBlur() {
    if (status === 'unsaved') doSave(text)
  }

  const statusLabel = { saved: 'saved ✓', unsaved: 'unsaved', saving: 'saving…' }[status]

  return (
    <div className="notes-editor">
      <div className="section-header">
        <div className="section-title">notes &amp; reflection</div>
        <div className="notes-actions">
          <span className={`save-status save-status--${status}`}>{statusLabel}</span>
          <button
            className="btn-ghost btn-sm"
            onClick={() => doSave(text)}
            disabled={status !== 'unsaved'}
          >
            save
          </button>
        </div>
      </div>

      <div className="prompts">
        {PROMPTS.map((p, i) => (
          <span key={i} className="prompt-chip">{p}</span>
        ))}
      </div>

      <textarea
        className="notes-textarea"
        placeholder="write your reflection here…"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        rows={6}
      />
    </div>
  )
}