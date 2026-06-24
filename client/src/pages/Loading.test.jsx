import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Loading from './Loading'

// Loading reads from the app context via useAppContext(). We mock the whole
// context module so the component renders in isolation without a real provider.
vi.mock('../context', () => ({
  useAppContext: () => ({
    user: { name: 'Keshav Kashyap' },
    loadingUser: false,
    token: null,
  }),
}))

describe('<Loading />', () => {
  it('shows the generic loader text for the default (nav) type', () => {
    render(<Loading />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows the reload message for type="reload"', () => {
    render(<Loading type="reload" />)
    expect(screen.getByText('Reloading your workspace...')).toBeInTheDocument()
  })

  it('greets an authenticated user by first name on the welcome screen', () => {
    render(<Loading type="welcome" />)
    expect(screen.getByText('Keshav')).toBeInTheDocument()
  })
})
