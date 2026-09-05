'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PlayerRow, TeamRow } from '@/types/database'
import { deletePlayer } from '@/app/broadcast/actions/players'
import PlayerFormModal from './PlayerFormModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// Enrich player rows with team info client-side
interface PlayerWithTeam extends PlayerRow {
  team?: TeamRow
}

export default function PlayersPanel() {
  const [players, setPlayers] = useState<PlayerWithTeam[]>([])
  const [teams, setTeams]   = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<PlayerRow | null>(null)
  const [deletingPlayer, setDeletingPlayer] = useState<PlayerWithTeam | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()

  // Active team filter
  const [filterTeam, setFilterTeam] = useState<string>('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    const supabase = createClient()

    const [{ data: playerData, error: playerErr }, { data: teamData, error: teamErr }] =
      await Promise.all([
        supabase.from('players').select('*').order('ign', { ascending: true }),
        supabase.from('teams').select('*').order('name', { ascending: true }),
      ])

    if (playerErr || teamErr) {
      setFetchError((playerErr ?? teamErr)!.message)
    } else {
      const teamMap = new Map((teamData ?? []).map((t) => [t.id, t]))
      const enriched = (playerData ?? []).map((p) => ({
        ...p,
        team: teamMap.get(p.team_id),
      }))
      setPlayers(enriched)
      setTeams(teamData ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = () => {
    if (!deletingPlayer) return
    setDeleteError(null)
    startDeleteTransition(async () => {
      const result = await deletePlayer(deletingPlayer.id)
      if (result.success) {
        setDeletingPlayer(null)
        fetchData()
      } else {
        setDeleteError(result.error ?? 'Delete failed.')
      }
    })
  }

  const visible = filterTeam === 'all'
    ? players
    : players.filter((p) => p.team_id === filterTeam)

  return (
    <section className="panel-card">
      {/* Header */}
      <div className="panel-card-header">
        <span className="panel-card-icon">👤</span>
        <h2 className="panel-card-title">Players</h2>
        <div className="panel-header-actions">
          {/* Team filter */}
          <select
            id="players-filter-team"
            className="field-select field-select--inline"
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            aria-label="Filter by team"
          >
            <option value="all">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            id="btn-add-player"
            className="btn btn--primary btn--sm"
            onClick={() => setShowAddModal(true)}
            disabled={teams.length === 0}
            title={teams.length === 0 ? 'Add teams first' : 'Add a player'}
          >
            + Add Player
          </button>
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div className="data-loading">
          <span className="spinner" />
          <span>Loading players…</span>
        </div>
      )}

      {!loading && fetchError && (
        <div className="data-error" role="alert">
          <span>⚠️ {fetchError}</span>
          <button className="btn btn--ghost btn--sm" onClick={fetchData}>Retry</button>
        </div>
      )}

      {!loading && !fetchError && visible.length === 0 && (
        <div className="data-empty">
          <p>
            {teams.length === 0
              ? 'No teams exist yet. Add teams first, then add players.'
              : 'No players found. Add one or seed demo data from the Teams tab.'}
          </p>
        </div>
      )}

      {!loading && !fetchError && visible.length > 0 && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>IGN</th>
                <th>Full Name</th>
                <th>Team</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((player) => (
                <tr key={player.id}>
                  <td>
                    <div className="team-logo-cell">
                      {player.photo_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={player.photo_url} alt={player.ign} className="player-photo-img" />
                      ) : (
                        <div className="player-photo-placeholder">
                          {player.ign.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="cell-primary cell-ign">{player.ign}</td>
                  <td className="cell-secondary">{player.name}</td>
                  <td>
                    {player.team && (
                      <span className="tag-badge tag-badge--team">{player.team.tag}</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn btn--ghost btn--xs"
                        onClick={() => setEditingPlayer(player)}
                        aria-label={`Edit ${player.ign}`}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn btn--danger-ghost btn--xs"
                        onClick={() => { setDeletingPlayer(player); setDeleteError(null) }}
                        aria-label={`Delete ${player.ign}`}
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

      {/* Footer: total count */}
      {!loading && !fetchError && players.length > 0 && (
        <p className="table-footer">
          {visible.length} player{visible.length !== 1 ? 's' : ''}
          {filterTeam !== 'all' && ` · ${players.length} total`}
        </p>
      )}

      {/* Modals */}
      <PlayerFormModal
        teams={teams}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchData}
      />

      {editingPlayer && (
        <PlayerFormModal
          player={editingPlayer}
          teams={teams}
          isOpen={!!editingPlayer}
          onClose={() => setEditingPlayer(null)}
          onSuccess={fetchData}
        />
      )}

      <ConfirmDialog
        isOpen={!!deletingPlayer}
        onClose={() => { setDeletingPlayer(null); setDeleteError(null) }}
        onConfirm={handleDelete}
        title="Delete Player"
        message={`Delete player "${deletingPlayer?.ign}"? This cannot be undone.`}
        confirmLabel="Delete Player"
        isPending={isDeleting}
      />
      {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
    </section>
  )
}
