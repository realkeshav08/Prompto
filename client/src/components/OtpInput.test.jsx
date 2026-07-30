import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import OtpInput from './OtpInput'

/* The component is controlled, so a bare render never advances past the first
   box — `value` would never change. This host mirrors how Login uses it, which
   is what makes the focus assertions meaningful. */
function Harness({ initial = '' }) {
  const [code, setCode] = useState(initial)
  return <OtpInput value={code} onChange={setCode} />
}

const boxes = () => screen.getAllByRole('textbox')

describe('OtpInput', () => {
  it('advances focus to the next box as digits are typed', () => {
    render(<Harness />)
    fireEvent.change(boxes()[0], { target: { value: '9' } })

    // Regression: the sequential-entry guard used to read a stale `value` during
    // the synchronous focus event and send the caret straight back to box 0.
    expect(boxes()[0]).toHaveValue('9')
    expect(document.activeElement).toBe(boxes()[1])
  })

  it('fills every box in order and stops focus at the last one', () => {
    render(<Harness />)
    boxes()[0].focus()
    // Typing into whatever currently holds focus is the point: if auto-advance
    // regresses, every digit lands in the same box and the join below fails.
    for (const digit of '123456') {
      fireEvent.change(document.activeElement, { target: { value: digit } })
    }
    expect(boxes().map((b) => b.value).join('')).toBe('123456')
    expect(document.activeElement).toBe(boxes()[5])
  })

  it('ignores non-numeric input', () => {
    render(<Harness />)
    fireEvent.change(boxes()[0], { target: { value: 'a' } })
    expect(boxes()[0]).toHaveValue('')
    expect(document.activeElement).not.toBe(boxes()[1])
  })

  it('clears the current digit on backspace, then steps back when empty', () => {
    render(<Harness initial="12" />)
    fireEvent.keyDown(boxes()[1], { key: 'Backspace' })
    expect(boxes()[1]).toHaveValue('')

    fireEvent.keyDown(boxes()[1], { key: 'Backspace' })
    expect(boxes()[0]).toHaveValue('')
    expect(document.activeElement).toBe(boxes()[0])
  })

  it('distributes a pasted code across the boxes', () => {
    render(<Harness />)
    fireEvent.paste(boxes()[0], {
      clipboardData: { getData: () => '654321' },
    })
    expect(boxes().map((b) => b.value).join('')).toBe('654321')
  })

  it('sends focus back to the first empty box when a later one is clicked', () => {
    render(<Harness initial="12" />)
    fireEvent.focus(boxes()[5])
    expect(document.activeElement).toBe(boxes()[2])
  })
})
