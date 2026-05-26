import { useState, useEffect, useRef } from 'react'

// ---------- color math ----------
function hexToRgb(hex) {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i)
  if (!m) return { r: 0, g: 0, b: 0 }
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex({ r, g, b }) {
  const c = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return '#' + c(r) + c(g) + c(b)
}

function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const v = max
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, v }
}

function hsvToRgb({ h, s, v }) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60)       [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else              [r, g, b] = [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

const hexToHsv = hex => rgbToHsv(hexToRgb(hex))

// ---------- component ----------
export default function ColorPicker({ initialColor = '#FAC775', onConfirm, onCancel }) {
  const [hsv, setHsv] = useState(() => hexToHsv(initialColor))
  const [hexInput, setHexInput] = useState(initialColor.toLowerCase())
  const svRef = useRef(null)
  const hueRef = useRef(null)
  const draggingRef = useRef(null) // 'sv' | 'hue' | null

  const rgb = hsvToRgb(hsv)
  const hex = rgbToHex(rgb)
  const hueColor = `hsl(${hsv.h}, 100%, 50%)`
  const supportsEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window

  // keep hex input synced when hsv changes (unless user is typing)
  useEffect(() => {
    setHexInput(hex.toLowerCase())
  }, [hex])

  function handleSvMove(e) {
    if (!svRef.current) return
    const rect = svRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    setHsv(prev => ({ ...prev, s: x, v: 1 - y }))
  }

  function handleHueMove(e) {
    if (!hueRef.current) return
    const rect = hueRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    setHsv(prev => ({ ...prev, h: x * 360 }))
  }

  useEffect(() => {
    function move(e) {
      if (draggingRef.current === 'sv')  handleSvMove(e)
      if (draggingRef.current === 'hue') handleHueMove(e)
    }
    function up() { draggingRef.current = null }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
    }
  }, [])

  function startSv(e)  { draggingRef.current = 'sv';  handleSvMove(e) }
  function startHue(e) { draggingRef.current = 'hue'; handleHueMove(e) }

  function setRgbChannel(channel, value) {
    const v = parseInt(value, 10)
    if (isNaN(v)) return
    const newRgb = { ...rgb, [channel]: Math.max(0, Math.min(255, v)) }
    setHsv(rgbToHsv(newRgb))
  }

  function commitHexInput() {
    let s = hexInput.trim()
    if (!s.startsWith('#')) s = '#' + s
    if (/^#[0-9a-f]{6}$/i.test(s)) setHsv(hexToHsv(s))
    else setHexInput(hex.toLowerCase()) // revert if invalid
  }

  async function useEyeDropper() {
    if (!supportsEyeDropper) return
    try {
      const ed = new window.EyeDropper()
      const result = await ed.open()
      setHsv(hexToHsv(result.sRGBHex))
    } catch {
      // user cancelled — ignore
    }
  }

  return (
    <div className="cp">
      {/* saturation × value square */}
      <div
        ref={svRef}
        className="cp-sv"
        style={{ background: hueColor }}
        onMouseDown={startSv}
        onTouchStart={startSv}
      >
        <div className="cp-sv-white" />
        <div className="cp-sv-black" />
        <div
          className="cp-sv-thumb"
          style={{
            left: `${hsv.s * 100}%`,
            top:  `${(1 - hsv.v) * 100}%`,
            background: hex,
          }}
        />
      </div>

      {/* preview, eyedropper, hue slider */}
      <div className="cp-controls">
        <div className="cp-preview" style={{ background: hex }} />
        {supportsEyeDropper && (
          <button type="button" className="cp-eyedropper" onClick={useEyeDropper} title="pick from screen">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 22l1-4 12-12 3 3-12 12-4 1z" />
              <path d="M14.5 6.5l3 3" />
              <path d="M17 2l5 5-3 3-5-5z" />
            </svg>
          </button>
        )}
        <div
          ref={hueRef}
          className="cp-hue"
          onMouseDown={startHue}
          onTouchStart={startHue}
        >
          <div
            className="cp-hue-thumb"
            style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }}
          />
        </div>
      </div>

      {/* hex + rgb inputs */}
      <div className="cp-inputs">
        <label className="cp-input cp-input--hex">
          <span className="cp-input-label">Hex</span>
          <input
            type="text"
            value={hexInput}
            onChange={e => setHexInput(e.target.value)}
            onBlur={commitHexInput}
            onKeyDown={e => { if (e.key === 'Enter') commitHexInput() }}
          />
        </label>
        <label className="cp-input">
          <span className="cp-input-label">R</span>
          <input type="number" min="0" max="255" value={Math.round(rgb.r)} onChange={e => setRgbChannel('r', e.target.value)} />
        </label>
        <label className="cp-input">
          <span className="cp-input-label">G</span>
          <input type="number" min="0" max="255" value={Math.round(rgb.g)} onChange={e => setRgbChannel('g', e.target.value)} />
        </label>
        <label className="cp-input">
          <span className="cp-input-label">B</span>
          <input type="number" min="0" max="255" value={Math.round(rgb.b)} onChange={e => setRgbChannel('b', e.target.value)} />
        </label>
      </div>

      <div className="cp-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>cancel</button>
        <button type="button" className="btn-primary" onClick={() => onConfirm(hex)}>ok</button>
      </div>
    </div>
  )
}
