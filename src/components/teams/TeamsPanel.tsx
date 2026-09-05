'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TeamRow } from '@/types/database'
import { deleteTeam, seedDemoData } from '@/app/broadcast/actions/teams'
import TeamFormModal from './TeamFormModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export default function TeamsPanel() {
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null)
  const [deletingTeam, setDeletingTeam] = useState<TeamRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isSeeding, startSeedTransition] = useTransition()
  const [seedMessage, setSeedMessage] = useState<string | null>(null)

  const fetchTeams = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      setFetchError(error.message)
    } else {
      setTeams(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchTeams() }, [fetchTeams])

  const handleDelete = () => {
    if (!deletingTeam) return
    setDeleteError(null)
    startDeleteTransition(async () => {
      const result = await deleteTeam(deletingTeam.id)
      if (result.success) {
        setDeletingTeam(null)
        fetchTeams()
      } else {
        setDeleteError(result.error ?? 'Delete failed.')
      }
    })
  }

  const handleSeed = () => {
    setSeedMessage(null)
    startSeedTransition(async () => {
      const result = await seedDemoData()
      setSeedMessage(result.error ?? (result.success ? 'Demo data seeded!' : 'Seed failed.'))
      if (result.success) fetchTeams()
    })
  }

  return (
    <section className="panel-card">
      {/* Header */}
      <div className="panel-card-header">
        <span className="panel-card-icon">🛡️</span>
        <h2 className="panel-card-title">Teams</h2>
        <div className="panel-header-actions">
          <button
            id="btn-seed-teams"
            className="btn btn--ghost btn--sm"
            onClick={handleSeed}
            disabled={isSeeding}
            title="Insert 5 demo teams + players if none exist"
          >
            {isSeeding ? 'Seeding…' : '🌱 Seed Demo'}
          </button>
          <button
            id="btn-add-team"
            className="btn btn--primary btn--sm"
            onClick={() => setShowAddModal(true)}
          >
            + Add Team
          </button>
        </div>
      </div>

      {/* Seed feedback */}
      {seedMessage && (
        <p className="form-info" role="status">{seedMessage}</p>
      )}

      {/* Body */}
      {loading && (
        <div className="data-loading">
          <span className="spinner" />
          <span>Loading teams…</span>
        </div>
      )}

      {!loading && fetchError && (
        <div className="data-error" role="alert">
          <span>⚠️ {fetchError}</span>
          <button className="btn btn--ghost btn--sm" onClick={fetchTeams}>Retry</button>
        </div>
      )}

      {!loading && !fetchError && teams.length === 0 && (
        <div className="data-empty">
          <p>No teams yet. Add one or seed demo data.</p>
        </div>
      )}

      {!loading && !fetchError && teams.length > 0 && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Logo</th>
                <th>Team</th>
                <th>Tag</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td>
                    <div className="team-logo-cell">
                      {team.logo_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={team.logo_url} alt={team.name} className="team-logo-img" />
                      ) : (
                        <div className="team-logo-placeholder">
                          {team.tag.charAt(0)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="cell-primary">{team.name}</td>
                  <td>
                    <span className="tag-badge">{team.tag}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn btn--ghost btn--xs"
                        onClick={() => setEditingTeam(team)}
                        aria-label={`Edit ${team.name}`}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn btn--danger-ghost btn--xs"
                        onClick={() => { setDeletingTeam(team); setDeleteError(null) }}
                        aria-label={`Delete ${team.name}`}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <TeamFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchTeams}
      />

      {editingTeam && (
        <TeamFormModal
          team={editingTeam}
          isOpen={!!editingTeam}
          onClose={() => setEditingTeam(null)}
          onSuccess={fetchTeams}
        />
      )}

      <ConfirmDialog
        isOpen={!!deletingTeam}
        onClose={() => { setDeletingTeam(null); setDeleteError(null) }}
        onConfirm={handleDelete}
        title="Delete Team"
        message={`Delete "${deletingTeam?.name}"? This will also delete all their players and scores.`}
        confirmLabel="Delete Team"
        isPending={isDeleting}
      />
      {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
    </section>
  )
}
