import { useState, useEffect, useRef } from 'react'

const PROMPTS = [
  'what did you listen to intentionally vs. just as background?',
  'did anything surprise you about what came up today?',
  'any new artists or tracks worth noting?',
  'how did the music fit the activity you were doing?',
  'anything you want to revisit or explore more?',
]

export default function NotesEditor({ value, saved, onSave }) {
  const [text, setText] = useState(value ?? '')
  const [dirty, setDirty] = useState(false)
  const timerRef = useRef(null)

  // Sync incoming value when day changes
  useEffect(() => {
    setText(value ?? '')
    setDirty(false)
  }, [value])

  function handleChange(e) {
    setText(e.target.value)
    setDirty(true)
    clearTimeout(timerRef.current)
    // autosave after 1.5s of no typing
    timerRef.current = setTimeout(() => {
      onSave(e.target.value)
      setDirty(false)
    }, 1500)
  }

  function handleBlur() {
    if (dirty) {
      clearTimeout(timerRef.current)
      onSave(text)
      setDirty(false)
    }
  }

  return (
    <div className="notes-editor">
      <div className="section-header">
        <div className="section-title">notes & reflection</div>
        <div className="save-status">
          {saved && !dirty ? <span className="saved-tag">saved ✓</span> : null}
          {dirty ? <span className="unsaved-tag">unsaved</span> : null}
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
