'use client'

import { useState, useMemo } from 'react'
import { MatchInfo, Round, BGMap, Match, ROUNDS, GROUPS, MAPS, MATCHES } from '@/types/broadcast'

interface Props {
  info: MatchInfo
  onChange: (info: MatchInfo) => void
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  id,
}: {
  label: string
  value: T
  options: T[]
  onChange: (v: T) => void
  id: string
}) {
  return (
    <div className="match-field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <select
        id={id}
        className="field-select"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}

export default function CurrentMatchSection({ info, onChange }: Props) {
  const [userGroups, setUserGroups] = useState<string[]>([])
  const [isAddingGroup, setIsAddingGroup] = useState(false)
  const [customGroupNum, setCustomGroupNum] = useState('')

  const availableGroups = useMemo(() => {
    const set = new Set<string>(GROUPS)
    userGroups.forEach((g) => set.add(g))
    if (info.group) set.add(info.group)
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0
      if (numA !== numB) return numA - numB
      return a.localeCompare(b)
    })
  }, [userGroups, info.group])

  const handleAddCustomGroup = () => {
    const trimmed = customGroupNum.trim()
    if (!trimmed) return
    const num = parseInt(trimmed, 10)
    const formattedGroup = !isNaN(num) && num > 0 ? `Group ${num}` : `Group ${trimmed}`
    setUserGroups((prev) => (prev.includes(formattedGroup) ? prev : [...prev, formattedGroup]))
    onChange({ ...info, group: formattedGroup })
    setCustomGroupNum('')
    setIsAddingGroup(false)
  }

  return (
    <section className="panel-card">
      <div className="panel-card-header">
        <span className="panel-card-icon">🎯</span>
        <h2 className="panel-card-title">Current Match</h2>
      </div>

      <div className="match-grid">
        <SelectField<Round>
          id="select-round"
          label="Round"
          value={info.round}
          options={ROUNDS}
          onChange={(v) => onChange({ ...info, round: v })}
        />

        {/* Dynamic Unlimited Group Selector */}
        <div className="match-field">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label className="field-label" htmlFor="select-group">Group</label>
            {!isAddingGroup && (
              <button
                type="button"
                onClick={() => setIsAddingGroup(true)}
                style={{
                  fontSize: '11px',
                  color: 'var(--clr-accent)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  padding: '0 2px',
                }}
                title="Create a new group number (unlimited)"
              >
                + Add Group
              </button>
            )}
          </div>

          {!isAddingGroup ? (
            <select
              id="select-group"
              className="field-select"
              value={info.group}
              onChange={(e) => {
                if (e.target.value === '__add_new__') {
                  setIsAddingGroup(true)
                } else {
                  onChange({ ...info, group: e.target.value })
                }
              }}
            >
              {availableGroups.map((grp) => (
                <option key={grp} value={grp}>{grp}</option>
              ))}
              <option value="__add_new__">+ Add New Group...</option>
            </select>
          ) : (
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="number"
                min="1"
                placeholder="Group # (e.g. 9, 10)"
                className="field-input"
                style={{ padding: '6px 8px', fontSize: '13px' }}
                value={customGroupNum}
                onChange={(e) => setCustomGroupNum(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCustomGroup()
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                className="btn btn--primary btn--xs"
                onClick={handleAddCustomGroup}
                style={{ padding: '0 8px', fontWeight: 700 }}
              >
                Add
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                onClick={() => {
                  setIsAddingGroup(false)
                  setCustomGroupNum('')
                }}
                style={{ padding: '0 6px' }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <SelectField<BGMap>
          id="select-map"
          label="Map"
          value={info.map}
          options={MAPS}
          onChange={(v) => onChange({ ...info, map: v })}
        />
        <SelectField<Match>
          id="select-match"
          label="Match"
          value={info.match}
          options={MATCHES}
          onChange={(v) => onChange({ ...info, match: v })}
        />
      </div>

      {/* Current values summary strip */}
      <div className="match-summary">
        <span className="match-tag">{info.round}</span>
        <span className="match-tag-sep">·</span>
        <span className="match-tag">{info.group}</span>
        <span className="match-tag-sep">·</span>
        <span className="match-tag map-tag">{info.map}</span>
        <span className="match-tag-sep">·</span>
        <span className="match-tag">{info.match}</span>
      </div>
    </section>
  )
}
