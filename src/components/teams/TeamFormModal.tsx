'use client'

import { useState, useMemo, useTransition } from 'react'
import { createTeam, updateTeam } from '@/app/broadcast/actions/teams'
import { TeamRow } from '@/types/database'
import Modal from '@/components/ui/Modal'

interface Props {
  team?: TeamRow           // undefined = create mode, defined = edit mode
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function TeamFormModal({ team, isOpen, onClose, onSuccess }: Props) {
  const isEdit = !!team
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [groupValue, setGroupValue] = useState<number>(team?.group_number ?? 1)
  const [isCustomGroup, setIsCustomGroup] = useState<boolean>((team?.group_number ?? 1) > 8)

  const groupOptions = useMemo(() => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8]
    if (team?.group_number && !list.includes(team.group_number)) {
      list.push(team.group_number)
      list.sort((a, b) => a - b)
    }
    return list
  }, [team])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const result = isEdit ? await updateTeam(formData) : await createTeam(formData)
      if (result.success) {
        onSuccess()
        onClose()
        form.reset()
      } else {
        setError(result.error ?? 'Something went wrong.')
      }
    })
  }

  const handleClose = () => {
    setError(null)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEdit ? 'Edit Team' : 'Add Team'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="form-stack" noValidate>
        {/* Hidden field for edit mode */}
        {isEdit && <input type="hidden" name="id" value={team.id} />}

        <div className="form-field">
          <label className="field-label" htmlFor="team-name">Team Name *</label>
          <input
            id="team-name"
            name="name"
            type="text"
            className="field-input"
            placeholder="e.g. Soul Esports"
            defaultValue={team?.name ?? ''}
            required
            maxLength={60}
          />
        </div>

        <div className="form-field">
          <label className="field-label" htmlFor="team-tag">Tag *</label>
          <input
            id="team-tag"
            name="tag"
            type="text"
            className="field-input"
            placeholder="e.g. SOUL"
            defaultValue={team?.tag ?? ''}
            required
            maxLength={8}
            style={{ textTransform: 'uppercase' }}
          />
        </div>

        <div className="match-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-field">
            <label className="field-label" htmlFor="team-round">Round</label>
            <select
              id="team-round"
              name="round"
              className="field-select"
              defaultValue={team?.round ?? 1}
            >
              <option value={1}>Round 1</option>
              <option value={2}>Round 2</option>
              <option value={3}>Round 3</option>
              <option value={4}>Round 4</option>
              <option value={5}>Round 5</option>
            </select>
          </div>

          <div className="form-field">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="field-label" htmlFor="team-group">
                Group {isCustomGroup ? '(Custom)' : ''}
              </label>
              <button
                type="button"
                onClick={() => setIsCustomGroup((prev) => !prev)}
                style={{
                  fontSize: '11px',
                  color: 'var(--clr-accent)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {isCustomGroup ? '← List' : '+ Custom #'}
              </button>
            </div>

            {!isCustomGroup ? (
              <select
                id="team-group"
                name="group_number"
                className="field-select"
                value={groupValue}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setIsCustomGroup(true)
                  } else {
                    setGroupValue(parseInt(e.target.value, 10))
                  }
                }}
              >
                {groupOptions.map((g) => (
                  <option key={g} value={g}>Group {g}</option>
                ))}
                <option value="custom">+ Other / Custom Group...</option>
              </select>
            ) : (
              <input
                id="team-group-custom"
                name="group_number"
                type="number"
                min="1"
                className="field-input"
                value={groupValue}
                onChange={(e) => setGroupValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                placeholder="Enter Group Number (e.g. 9, 10...)"
                autoFocus
              />
            )}
          </div>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}


        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={isPending}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={isPending} aria-busy={isPending}>
            {isPending ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save Changes' : 'Add Team')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
