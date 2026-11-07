import React from 'react'
import { PASSWORD_RULES } from '../utils/password'

// Live checklist that ticks each password rule as it becomes satisfied.
const PasswordChecklist = ({ value = '' }) => (
  <ul className="space-y-1.5 mt-1">
    {PASSWORD_RULES.map((rule) => {
      const ok = rule.test(value)
      return (
        <li
          key={rule.label}
          className={`flex items-center gap-2 text-[11px] font-semibold transition-colors ${ok ? 'text-green-500' : 'text-muted'}`}
        >
          <span
            className={`w-4 h-4 shrink-0 flex items-center justify-center rounded-full text-[9px] ${ok ? 'bg-green-500/15' : 'bg-muted/15'}`}
          >
            {ok ? '✓' : '○'}
          </span>
          {rule.label}
        </li>
      )
    })}
  </ul>
)

export default PasswordChecklist
