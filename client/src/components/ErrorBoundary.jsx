import React from 'react'

// React only catches render-time errors through an Error Boundary (a class
// component implementing getDerivedStateFromError / componentDidCatch). A
// try/catch around JSX does NOT work, because JSX only *creates* elements —
// the actual rendering (where errors throw) happens later, outside that scope.
class ErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}

export default ErrorBoundary
