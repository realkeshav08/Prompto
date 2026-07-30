import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Skeleton from './Skeleton'

describe('<Skeleton />', () => {
  it('renders the full app-shell skeleton by default', () => {
    render(<Skeleton />)
    expect(screen.getByRole('status', { name: 'Loading workspace' })).toBeInTheDocument()
  })

  it('renders a content-only skeleton for the content variant', () => {
    render(<Skeleton variant="content" />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })
})
