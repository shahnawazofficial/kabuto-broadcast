'use client'

import { useState, useEffect, useCallback, useTransition, useMemo } from 'react'
import { TeamRow } from '@/types/database'
import { deleteTeam, deleteTeamsBatch, getTeamsWithRoundGroup, assignTeamsToGroup } from '@/app/broadcast/actions/teams'
import TeamFormModal from './TeamFormModal'
import ImportTeamsModal, { ImportSuccessInfo } from './ImportTeamsModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Modal from '@/components/ui/Modal'

export function getGroupBadgeStyle(groupNumber: number) {
  const palettes = [
    { border: 'rgba(245, 158, 11, 0.4)', bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },  // Gold
    { border: 'rgba(56, 189, 248, 0.4)', bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8' },  // Sky
    { border: 'rgba(52, 211, 153, 0.4)', bg: 'rgba(52, 211, 153, 0.15)', text: '#34d399' },  // Emerald
    { border: 'rgba(168, 85, 247, 0.4)', bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc' },  // Purple
    { border: 'rgba(244, 63, 94, 0.4)',  bg: 'rgba(244, 63, 94, 0.15)',  text: '#fb7185' },  // Rose
    { border: 'rgba(234, 179, 8, 0.4)',  bg: 'rgba(234, 179, 8, 0.15)',  text: '#facc15' },  // Yellow
    { border: 'rgba(99, 102, 241, 0.4)', bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8' },  // Indigo
    { border: 'rgba(20, 184, 166, 0.4)', bg: 'rgba(20, 184, 166, 0.15)', text: '#2dd4bf' },  // Teal
  ]
  const idx = Math.max(0, (groupNumber || 1) - 1) % palettes.length
  return palettes[idx]
}

export default function TeamsPanel() {
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Modals & form state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null)
  const [deletingTeam, setDeletingTeam] = useState<TeamRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()

  // Multi-selection state & batch delete / move
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set())
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)
  const [isBatchDeleting, startBatchDeleteTransition] = useTransition()
  const [targetAssignGroup, setTargetAssignGroup] = useState<string>('R1-G1')
  const [isAssigning, startAssignTransition] = useTransition()
  const [customBulkRound, setCustomBulkRound] = useState<number>(1)
  const [customBulkGroup, setCustomBulkGroup] = useState<number>(9)

  // Dynamic unlimited groups state
  const [userAddedGroups, setUserAddedGroups] = useState<number[]>([])
  const [showAddGroupModal, setShowAddGroupModal] = useState(false)
  const [newGroupInput, setNewGroupInput] = useState('')

  // Filter state & notification banner
  const [selectedFilter, setSelectedFilter] = useState<string>('all')
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchTeams = useCallback(async () => {
    setLoading(true)
    setFetchError(null)

    const result = await getTeamsWithRoundGroup()
    if (result.success && result.data) {
      setTeams(result.data)
    } else {
      setFetchError(result.error ?? 'Failed to load teams.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const handleDelete = () => {
    if (!deletingTeam) return
    setDeleteError(null)
    startDeleteTransition(async () => {
      const result = await deleteTeam(deletingTeam.id)
      if (result.success) {
        setSelectedTeamIds((prev) => {
          const next = new Set(prev)
          next.delete(deletingTeam.id)
          return next
        })
        setDeletingTeam(null)
        fetchTeams()
      } else {
        setDeleteError(result.error ?? 'Delete failed.')
      }
    })
  }

  const handleBatchDelete = () => {
    if (selectedTeamIds.size === 0) return
    setDeleteError(null)
    const ids = Array.from(selectedTeamIds)
    startBatchDeleteTransition(async () => {
      const result = await deleteTeamsBatch(ids)
      if (result.success) {
        setShowBatchDeleteConfirm(false)
        setSelectedTeamIds(new Set())
        setBannerMessage({
          type: 'success',
          text: `🗑️ Successfully deleted ${ids.length} teams.`,
        })
        fetchTeams()
      } else {
        setDeleteError(result.error ?? 'Failed to delete selected teams.')
      }
    })
  }

  const handleBatchAssign = (groupKey: string) => {
    if (selectedTeamIds.size === 0) return
    const match = groupKey.match(/^R(\d+)-G(\d+)$/)
    if (!match) return
    const round = parseInt(match[1], 10)
    const group = parseInt(match[2], 10)
    const ids = Array.from(selectedTeamIds)
    startAssignTransition(async () => {
      const res = await assignTeamsToGroup(ids, round, group)
      if (res.success) {
        setBannerMessage({
          type: 'success',
          text: `Moved ${ids.length} team(s) to Round ${round} · Group ${group}!`,
        })
        fetchTeams()
      } else {
        setBannerMessage({
          type: 'error',
          text: res.error || 'Failed to move teams.',
        })
      }
    })
  }

  const handleSingleTeamAssign = (teamId: string, groupKey: string) => {
    const match = groupKey.match(/^R(\d+)-G(\d+)$/)
    if (!match) return
    const round = parseInt(match[1], 10)
    const group = parseInt(match[2], 10)
    startAssignTransition(async () => {
      const res = await assignTeamsToGroup([teamId], round, group)
      if (res.success) {
        fetchTeams()
      }
    })
  }

  const handleImportSuccess = (info?: ImportSuccessInfo) => {
    fetchTeams()
    if (info) {
      const key = `R${info.round}-G${info.group}`
      setSelectedFilter(key)
      setBannerMessage({
        type: 'success',
        text: `🎉 Round ${info.round} · Group ${info.group} teams imported successfully! (${info.count} teams added/linked)`,
      })
    }
  }

  const toggleSelectTeam = (id: string) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filter logic
  const filteredTeams = useMemo(() => {
    if (selectedFilter === 'all') return teams
    const match = selectedFilter.match(/^R(\d+)-G(\d+)$/)
    if (!match) return teams
    const r = parseInt(match[1], 10)
    const g = parseInt(match[2], 10)
    return teams.filter((t) => (t.round ?? 1) === r && (t.group_number ?? 1) === g)
  }, [teams, selectedFilter])

  const allVisibleSelected = useMemo(() => {
    return filteredTeams.length > 0 && filteredTeams.every((t) => selectedTeamIds.has(t.id))
  }, [filteredTeams, selectedTeamIds])

  const someVisibleSelected = useMemo(() => {
    return filteredTeams.some((t) => selectedTeamIds.has(t.id))
  }, [filteredTeams, selectedTeamIds])

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedTeamIds((prev) => {
        const next = new Set(prev)
        filteredTeams.forEach((t) => next.delete(t.id))
        return next
      })
    } else {
      setSelectedTeamIds((prev) => {
        const next = new Set(prev)
        filteredTeams.forEach((t) => next.add(t.id))
        return next
      })
    }
  }

  const knownGroups = useMemo(() => {
    const set = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8])
    teams.forEach((t) => {
      if (typeof t.group_number === 'number') set.add(t.group_number)
    })
    userAddedGroups.forEach((g) => set.add(g))
    return Array.from(set).sort((a, b) => a - b)
  }, [teams, userAddedGroups])

  const assignOptions = useMemo(() => {
    const options: { value: string; label: string }[] = []
    for (let r = 1; r <= 3; r++) {
      knownGroups.forEach((g) => {
        options.push({ value: `R${r}-G${g}`, label: `Round ${r} · Group ${g}` })
      })
    }
    return options
  }, [knownGroups])

  const handleAddNewGroup = (groupNum: number) => {
    if (isNaN(groupNum) || groupNum < 1) return
    setUserAddedGroups((prev) => (prev.includes(groupNum) ? prev : [...prev, groupNum]))
    setShowAddGroupModal(false)
    setNewGroupInput('')
    setSelectedFilter(`R1-G${groupNum}`)
    setTargetAssignGroup(`R1-G${groupNum}`)
    setBannerMessage({
      type: 'success',
      text: `🎉 Group ${groupNum} created! Filter set to Round 1 · Group ${groupNum}. You can now assign teams to it.`,
    })
  }

  // Dynamic filter options based on tournament rounds & groups
  const filterOptions = useMemo(() => {
    const list: { value: string; label: string }[] = [{ value: 'all', label: `All Teams (${teams.length})` }]

    // Add all known groups across Rounds 1 to 5
    for (let r = 1; r <= 5; r++) {
      for (const g of knownGroups) {
        const count = teams.filter((t) => (t.round ?? 1) === r && (t.group_number ?? 1) === g).length
        if (count > 0 || r === 1 || (r <= 3 && g <= 8) || userAddedGroups.includes(g)) {
          list.push({
            value: `R${r}-G${g}`,
            label: `Round ${r} · Group ${g}${count > 0 ? ` (${count})` : ''}`,
          })
        }
      }
    }

    // Include any custom groups found in teams
    teams.forEach((t) => {
      const r = t.round ?? 1
      const g = t.group_number ?? 1
      const key = `R${r}-G${g}`
      if (!list.some((o) => o.value === key)) {
        list.push({ value: key, label: `Round ${r} · Group ${g}` })
      }
    })

    return list
  }, [teams, knownGroups, userAddedGroups])

  return (
    <section className="panel-card" id="teams-panel-section">
      {/* Header */}
      <div className="panel-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="panel-card-icon">🛡️</span>
          <div>
            <h2 className="panel-card-title">Teams Management</h2>
            <p className="panel-card-subtitle" style={{ fontSize: '12px', color: 'var(--clr-text-3)' }}>
              Total {teams.length} teams registered · Organized by Tournament Round & Group
            </p>
          </div>
        </div>
        <div className="panel-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {selectedTeamIds.size > 0 && (
            <button
              id="btn-header-delete-selected"
              className="btn btn--danger btn--sm"
              onClick={() => setShowBatchDeleteConfirm(true)}
              style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              🗑️ Delete Selected ({selectedTeamIds.size})
            </button>
          )}
          <button
            id="btn-add-group"
            className="btn btn--secondary btn--sm"
            onClick={() => setShowAddGroupModal(true)}
            style={{ fontWeight: 700, color: 'var(--clr-accent)', borderColor: 'rgba(245, 158, 11, 0.4)' }}
            title="Create a new tournament group (unlimited)"
          >
            ➕ Add Group
          </button>
          <button
            id="btn-import-teams"
            className="btn btn--secondary btn--sm"
            onClick={() => setShowImportModal(true)}
            title="Upload Excel (.xlsx/.xls) or CSV file containing team names"
          >
            📊 Import Excel / CSV
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

      {/* Notification banner */}
      {bannerMessage && (
        <div
          className={`points-alert points-alert--${bannerMessage.type}`}
          role="alert"
          style={{ margin: '12px 16px 0' }}
        >
          <span>{bannerMessage.type === 'success' ? '✓' : '⚠️'}</span>
          <span style={{ fontWeight: 600 }}>{bannerMessage.text}</span>
          <button
            className="points-alert-close"
            onClick={() => setBannerMessage(null)}
            aria-label="Dismiss banner"
          >
            ×
          </button>
        </div>
      )}

      {/* Multi-Select Bulk Action Bar */}
      {selectedTeamIds.size > 0 && (
        <div
          id="bulk-selection-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '6px',
            margin: '12px 16px 0',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: '#fca5a5' }}>
              ✓ {selectedTeamIds.size} of {teams.length} team(s) selected
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              onClick={toggleSelectAllVisible}
              style={{ fontSize: '11px', border: '1px solid var(--clr-border)' }}
            >
              {allVisibleSelected ? 'Deselect In Current View' : `Select All In View (${filteredTeams.length})`}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              onClick={() => setSelectedTeamIds(new Set(teams.map((t) => t.id)))}
              style={{ fontSize: '11px', border: '1px solid var(--clr-border)' }}
            >
              Select All Everywhere ({teams.length})
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              onClick={() => setSelectedTeamIds(new Set())}
              style={{ fontSize: '11px', color: 'var(--clr-text-3)' }}
            >
              Clear
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--clr-text-2)', fontWeight: 600 }}>
                Move to:
              </span>
              {targetAssignGroup !== 'custom' ? (
                <select
                  id="select-bulk-target-group"
                  className="field-select"
                  style={{ padding: '4px 8px', fontSize: '12px', width: 'auto', background: 'var(--clr-bg-3)' }}
                  value={targetAssignGroup}
                  onChange={(e) => setTargetAssignGroup(e.target.value)}
                  disabled={isAssigning}
                >
                  {assignOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                  <option value="custom">+ Custom Round &amp; Group...</option>
                </select>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <select
                    className="field-select"
                    style={{ padding: '4px 6px', fontSize: '12px', width: 'auto', background: 'var(--clr-bg-3)' }}
                    value={customBulkRound}
                    onChange={(e) => setCustomBulkRound(parseInt(e.target.value, 10))}
                  >
                    {[1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={r}>Round {r}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Group #"
                    className="field-input"
                    style={{ padding: '4px 6px', fontSize: '12px', width: '70px' }}
                    value={customBulkGroup}
                    onChange={(e) => setCustomBulkGroup(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs"
                    onClick={() => setTargetAssignGroup('R1-G1')}
                    title="Cancel custom group"
                  >
                    ✕
                  </button>
                </div>
              )}
              <button
                type="button"
                id="btn-apply-bulk-assign"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  if (targetAssignGroup === 'custom') {
                    handleBatchAssign(`R${customBulkRound}-G${customBulkGroup}`)
                  } else {
                    handleBatchAssign(targetAssignGroup)
                  }
                }}
                disabled={isAssigning}
                style={{ fontWeight: 700 }}
              >
                {isAssigning ? 'Moving...' : 'Apply Move'}
              </button>
            </div>
            <button
              id="btn-bulk-delete-confirm"
              type="button"
              className="btn btn--danger btn--sm"
              onClick={() => setShowBatchDeleteConfirm(true)}
              style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              🗑️ Delete {selectedTeamIds.size} Selected Team(s)
            </button>
          </div>
        </div>
      )}

      {/* Round & Group Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--clr-border)',
          background: 'var(--clr-bg-2)',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="filter-round-group" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--clr-text-2)', letterSpacing: '0.5px' }}>
            VIEW BY ROUND & GROUP:
          </label>
          <select
            id="filter-round-group"
            className="field-select"
            style={{ width: 'auto', minWidth: '220px', padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
          >
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--clr-text-3)' }}>
          Showing <strong>{filteredTeams.length}</strong> of <strong>{teams.length}</strong> teams
        </div>
      </div>

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
          <p>No teams registered yet. Upload an Excel or CSV file with your team names to start.</p>
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              className="btn btn--primary btn--sm"
              onClick={() => setShowImportModal(true)}
            >
              📊 Import Excel / CSV
            </button>
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => setShowAddModal(true)}
            >
              + Add Team Manually
            </button>
          </div>
        </div>
      )}

      {!loading && !fetchError && teams.length > 0 && filteredTeams.length === 0 && (
        <div className="data-empty" style={{ padding: '36px 16px' }}>
          <p style={{ fontWeight: 600, color: 'var(--clr-text)' }}>
            No teams found for the selected Round & Group filter ({selectedFilter}).
          </p>
          <p style={{ fontSize: '13px', color: 'var(--clr-text-3)', marginTop: '4px' }}>
            You can import an Excel/CSV file and assign it directly to this group.
          </p>
          <div style={{ marginTop: '14px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => setSelectedFilter('all')}
            >
              Show All Teams
            </button>
            <button
              className="btn btn--primary btn--sm"
              onClick={() => setShowImportModal(true)}
            >
              📊 Import Teams for this Group
            </button>
          </div>
        </div>
      )}

      {!loading && !fetchError && filteredTeams.length > 0 && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '42px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    id="checkbox-select-all"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected
                    }}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible teams"
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#ef4444' }}
                  />
                </th>
                <th style={{ width: '50px' }}>Logo</th>
                <th>Team Name</th>
                <th style={{ width: '90px' }}>Tag</th>
                <th style={{ width: '160px' }}>Round & Group</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeams.map((team) => {
                const isSelected = selectedTeamIds.has(team.id)
                return (
                  <tr
                    key={team.id}
                    style={isSelected ? { background: 'rgba(239, 68, 68, 0.08)' } : undefined}
                  >
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectTeam(team.id)}
                        aria-label={`Select ${team.name}`}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#ef4444' }}
                      />
                    </td>
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
                    <td className="cell-primary">
                      <span style={{ fontWeight: 600 }}>{team.name}</span>
                    </td>
                    <td>
                      <span className="tag-badge">{team.tag}</span>
                    </td>
                    <td>
                      <select
                        aria-label={`Change group for ${team.name}`}
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          outline: 'none',
                          border: `1px solid ${getGroupBadgeStyle(team.group_number ?? 1).border}`,
                          background: getGroupBadgeStyle(team.group_number ?? 1).bg,
                          color: getGroupBadgeStyle(team.group_number ?? 1).text,
                        }}
                        value={`R${team.round || 1}-G${team.group_number || 1}`}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            const customNum = prompt(
                              `Enter Group Number for "${team.name}" (Round ${team.round || 1}):`,
                              String((team.group_number || 1) + 1)
                            )
                            if (customNum) {
                              const num = parseInt(customNum, 10)
                              if (num > 0) {
                                handleSingleTeamAssign(team.id, `R${team.round || 1}-G${num}`)
                              }
                            }
                          } else {
                            handleSingleTeamAssign(team.id, e.target.value)
                          }
                        }}
                        disabled={isAssigning}
                      >
                        {assignOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                        {team.group_number && !assignOptions.some(o => o.value === `R${team.round || 1}-G${team.group_number}`) && (
                          <option value={`R${team.round || 1}-G${team.group_number}`}>
                            Round {team.round || 1} · Group {team.group_number}
                          </option>
                        )}
                        <option value="custom">+ Custom Group #...</option>
                      </select>
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
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <TeamFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          fetchTeams()
          setBannerMessage({ type: 'success', text: 'Team added successfully!' })
        }}
      />

      <ImportTeamsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />

      {editingTeam && (
        <TeamFormModal
          team={editingTeam}
          isOpen={!!editingTeam}
          onClose={() => setEditingTeam(null)}
          onSuccess={() => {
            fetchTeams()
            setBannerMessage({ type: 'success', text: `Team "${editingTeam.name}" updated successfully!` })
          }}
        />
      )}

      {/* Delete Single Team Dialog */}
      <ConfirmDialog
        isOpen={!!deletingTeam}
        onClose={() => { setDeletingTeam(null); setDeleteError(null) }}
        onConfirm={handleDelete}
        title="Delete Team"
        message={`Delete "${deletingTeam?.name}"? This will also delete all their players and scores.`}
        confirmLabel="Delete Team"
        isPending={isDeleting}
      />

      {/* Delete Multiple Teams Dialog */}
      <ConfirmDialog
        isOpen={showBatchDeleteConfirm}
        onClose={() => { setShowBatchDeleteConfirm(false); setDeleteError(null) }}
        onConfirm={handleBatchDelete}
        title="Delete Selected Teams"
        message={`Are you sure you want to delete ${selectedTeamIds.size} selected teams? This will permanently delete them along with all their players and match scores.`}
        confirmLabel={`Delete ${selectedTeamIds.size} Teams`}
        isPending={isBatchDeleting}
      />

      {/* Add New Group Modal */}
      {showAddGroupModal && (
        <Modal
          isOpen={showAddGroupModal}
          onClose={() => setShowAddGroupModal(false)}
          title="Add New Tournament Group"
          size="sm"
        >
          <div className="form-stack">
            <p style={{ fontSize: '13px', color: 'var(--clr-text-2)' }}>
              Enter any group number to create. Groups are unlimited (e.g. 9, 10, 16, 20...).
            </p>
            <div className="form-field">
              <label className="field-label" htmlFor="new-group-number-input">Group Number *</label>
              <input
                id="new-group-number-input"
                type="number"
                min="1"
                className="field-input"
                placeholder="e.g. 9, 10, 15..."
                value={newGroupInput}
                onChange={(e) => setNewGroupInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const num = parseInt(newGroupInput, 10)
                    if (num > 0) handleAddNewGroup(num)
                  }
                }}
                autoFocus
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowAddGroupModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  const num = parseInt(newGroupInput, 10)
                  if (num > 0) handleAddNewGroup(num)
                }}
                disabled={!newGroupInput || parseInt(newGroupInput, 10) < 1}
              >
                Create Group {newGroupInput ? parseInt(newGroupInput, 10) : ''}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteError && <p className="form-error" role="alert" style={{ margin: '12px 16px 0' }}>{deleteError}</p>}
    </section>

  )
}

