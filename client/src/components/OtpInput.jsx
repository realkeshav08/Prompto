import React, { useRef } from 'react'

// Segmented 6-digit numeric code input. `value` is the combined string (0–6
// digits); `onChange(next)` gets the new combined string. Auto-advances,
// supports backspace, arrow keys, and pasting a full code. Digits only.
const LENGTH = 6

const OtpInput = ({ value = '', onChange, autoFocus = false }) => {
  const refs = useRef([])

  // Set while we move focus ourselves. `.focus()` dispatches its event
  // synchronously, so handleFocus would otherwise run against the pre-update
  // `value` still captured in this render's closure and bounce the caret back.
  const movingFocus = useRef(false)

  const focus = (i) => {
    movingFocus.current = true
    refs.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus()
    movingFocus.current = false
  }

  const handleChange = (i, e) => {
    const digit = e.target.value.replace(/\D/g, '').slice(-1)
    if (!digit) return
    const next = (value.slice(0, i) + digit + value.slice(i + 1)).slice(0, LENGTH)
    onChange(next)
    focus(i + 1)
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (value[i]) {
        onChange(value.slice(0, i) + value.slice(i + 1))
      } else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i))
        focus(i - 1)
      }
    } else if (e.key === 'ArrowLeft') focus(i - 1)
    else if (e.key === 'ArrowRight') focus(i + 1)
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (!pasted) return
    onChange(pasted)
    focus(pasted.length)
  }

  // Keep entry sequential — clicking a box past the filled prefix jumps back to
  // the first empty one. Only applies to focus the user initiated; our own
  // auto-advance is already landing on the correct box.
  const handleFocus = (i) => {
    if (movingFocus.current) return
    if (i > value.length) focus(value.length)
  }

  return (
    <div className="flex gap-2 justify-between" onPaste={handlePaste}>
      {Array.from({ length: LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={() => handleFocus(i)}
          inputMode="numeric"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          className="flex-1 min-w-0 h-14 text-center text-lg font-black bg-accent-soft/30 border border-border/50 rounded-2xl outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all"
        />
      ))}
    </div>
  )
}

export default OtpInput
