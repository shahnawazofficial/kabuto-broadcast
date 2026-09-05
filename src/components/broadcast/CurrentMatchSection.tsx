'use client'

import { MatchInfo, Round, Group, BGMap, Match, ROUNDS, GROUPS, MAPS, MATCHES } from '@/types/broadcast'

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
        <SelectField<Group>
          id="select-group"
          label="Group"
          value={info.group}
          options={GROUPS}
          onChange={(v) => onChange({ ...info, group: v })}
        />
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
