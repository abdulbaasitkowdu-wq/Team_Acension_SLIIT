import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'

const FIELD = 'h-9 rounded-md border border-input bg-card px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Waits for typing to pause so each keystroke does not become a request. */
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const [draft, setDraft] = useState(value)
  const [seen, setSeen] = useState(value)
  // Follow outside changes, such as a link that sets a new search.
  if (value !== seen) {
    setSeen(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => onChange(draft), 300)
    return () => clearTimeout(timer)
  }, [draft, value, onChange])

  return (
    <div className="relative">
      <Search aria-hidden="true" className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
      <input
        type="search"
        aria-label="Search"
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className={`${FIELD} w-64 pl-8`}
      />
    </div>
  )
}

interface FilterSelectProps {
  label: string
  value: string | undefined
  onChange: (value: string) => void
  /** Text of the "no filter" choice. */
  all: string
  options: [value: string, label: string][]
}

export function FilterSelect({ label, value, onChange, all, options }: FilterSelectProps) {
  return (
    <select aria-label={label} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className={FIELD}>
      <option value="">{all}</option>
      {options.map(([option, text]) => (
        <option key={option} value={option}>
          {text}
        </option>
      ))}
    </select>
  )
}

export function DateFilter({ label, value, onChange }: { label: string; value: string | undefined; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-muted-foreground">
      {label}
      <input type="date" value={value ?? ''} onChange={(event) => onChange(event.target.value)} className={`${FIELD} text-foreground`} />
    </label>
  )
}
