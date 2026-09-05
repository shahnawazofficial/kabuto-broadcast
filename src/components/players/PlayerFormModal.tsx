'use client'

import { useState, useTransition } from 'react'
import { createPlayer, updatePlayer } from '@/app/broadcast/actions/players'
import { PlayerRow, TeamRow } from '@/types/database'
import Modal from '@/components/ui/Modal'

interface Props {
  player?: PlayerRow
  teams: TeamRow[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function PlayerFormModal({ player, teams, isOpen, onClose, onSuccess }: Props) {
  const isEdit = !!player
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const result = isEdit ? await updatePlayer(formData) : await createPlayer(formData)
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
      title={isEdit ? 'Edit Player' : 'Add Player'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="form-stack" noValidate>
        {isEdit && <input type="hidden" name="id" value={player.id} />}

        <div className="form-field">
          <label className="field-label" htmlFor="player-name">Full Name *</label>
          <input
            id="player-name"
            name="name"
            type="text"
            className="field-input"
            placeholder="e.g. Tanmay Singh"
            defaultValue={player?.name ?? ''}
            required
            maxLength={80}
          />
        </div>

        <div className="form-field">
          <label className="field-label" htmlFor="player-ign">IGN *</label>
          <input
            id="player-ign"
            name="ign"
            type="text"
            className="field-input"
            placeholder="e.g. Neyoo"
            defaultValue={player?.ign ?? ''}
            required
            maxLength={40}
          />
        </div>

        <div className="form-field">
          <label className="field-label" htmlFor="player-team">Team *</label>
          <select
            id="player-team"
            name="team_id"
            className="field-select"
            defaultValue={player?.team_id ?? ''}
            required
          >
            <option value="" disabled>Select team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="field-label" htmlFor="player-photo">Photo URL</label>
          <input
            id="player-photo"
            name="photo_url"
            type="url"
            className="field-input"
            placeholder="https://…"
            defaultValue={player?.photo_url ?? ''}
          />
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={isPending}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={isPending} aria-busy={isPending}>
            {isPending ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save Changes' : 'Add Player')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
