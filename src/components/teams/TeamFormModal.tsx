'use client'

import { useState, useTransition } from 'react'
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
            <label className="field-label" htmlFor="team-group">Group</label>
            <select
              id="team-group"
              name="group_number"
              className="field-select"
              defaultValue={team?.group_number ?? 1}
            >
              <option value={1}>Group 1</option>
              <option value={2}>Group 2</option>
              <option value={3}>Group 3</option>
              <option value={4}>Group 4</option>
              <option value={5}>Group 5</option>
              <option value={6}>Group 6</option>
              <option value={7}>Group 7</option>
              <option value={8}>Group 8</option>
            </select>
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
