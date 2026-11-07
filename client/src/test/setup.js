// Global test setup — runs once before each test file.
// Adds custom jest-dom matchers (e.g. toBeInTheDocument, toHaveTextContent)
// and auto-cleans the rendered DOM between tests so they stay isolated.
import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
