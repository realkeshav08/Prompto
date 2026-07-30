import React from 'react'

// Uses the app's theme tokens (bg-bg, bg-panel, glass, ...) so it adapts to
// light & dark automatically — React already knows the theme when this renders.
const Bar = ({ className = '' }) => (
  <div className={`bg-panel rounded-lg animate-pulse ${className}`} />
)

// The chat / content area (no sidebar). Fills its parent.
const ContentSkeleton = () => (
  <div className="h-full w-full flex flex-col px-6 py-8 bg-bg">
    <div className="flex-1 flex flex-col gap-6 max-w-3xl mx-auto w-full pt-4">
      <Bar className="h-16 w-3/4 self-start" />
      <Bar className="h-24 w-2/3 self-end" />
      <Bar className="h-16 w-3/5 self-start" />
    </div>
    <div className="max-w-3xl mx-auto w-full">
      <Bar className="h-14 w-full rounded-2xl" />
    </div>
  </div>
)

// variant='full'    → whole app shell (sidebar + content); used on boot.
// variant='content' → content area only; used for in-app route/data loading.
const Skeleton = ({ variant = 'full' }) => {
  if (variant === 'content') {
    return (
      <div className="h-full w-full" role="status" aria-label="Loading">
        <ContentSkeleton />
      </div>
    )
  }

  return (
    <div
      className="h-screen w-screen flex bg-bg text-text overflow-hidden"
      role="status"
      aria-label="Loading workspace"
    >
      {/* Sidebar — hidden on mobile, mirroring the real layout */}
      <aside className="hidden md:flex flex-col w-80 glass border-r px-6 py-8 gap-4">
        <Bar className="h-8 w-32" />
        <Bar className="h-10 w-full" />
        <Bar className="h-9 w-full" />
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bar key={i} className="h-12 w-full" />
          ))}
        </div>
      </aside>
      <ContentSkeleton />
    </div>
  )
}

export default Skeleton
