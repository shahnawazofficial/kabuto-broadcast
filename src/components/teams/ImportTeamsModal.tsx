'use client'

import { useState, useRef, useTransition } from 'react'
import * as XLSX from 'xlsx'
import Modal from '@/components/ui/Modal'
import { importTeamsBatch } from '@/app/broadcast/actions/teams'

interface ParsedTeam {
  name: string
  tag: string
}

export interface ImportSuccessInfo {
  round: number
  group: number
  count: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (info?: ImportSuccessInfo) => void
}

/**
 * Intelligent esports tag generator:
 * - "Team Soul" -> "SOUL"
 * - "GodLike Esports" -> "GL"
 * - "Entity Gaming" -> "EG"
 * - "Blind" -> "BLND"
 * - "Global Esports" -> "GE"
 */
function autoGenerateTag(name: string): string {
  const clean = name.trim()
  if (!clean) return 'TEAM'

  const words = clean.split(/\s+/).filter(Boolean)

  if (words.length >= 2) {
    // If name starts with "Team", prefer second word or "T" + initials
    if (words[0].toLowerCase() === 'team' && words.length > 1) {
      if (words.length === 2 && words[1].length <= 5) {
        return words[1].toUpperCase()
      }
      return ('T' + words.slice(1).map((w) => w[0]).join('')).toUpperCase().slice(0, 5)
    }

    // Initials e.g. "GodLike Esports" -> "GE" or "GL" if first word has internal caps
    const initials = words.map((w) => w[0]).join('').toUpperCase()
    if (initials.length >= 2 && initials.length <= 5) {
      return initials
    }
  }

  // Single word: remove vowels to get a clean esports tag (e.g. "Blind" -> "BLND")
  const consonants = clean.replace(/[^a-zA-Z]/g, '').replace(/[aeiouAEIOU]/g, '').toUpperCase()
  if (consonants.length >= 3 && consonants.length <= 5) {
    return consonants
  }

  // Fallback to first 4 alphanumeric characters
  const alpha = clean.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return alpha.slice(0, 4) || 'TEAM'
}

const COMMON_HEADERS = new Set([
  'team',
  'teams',
  'team name',
  'team_name',
  'teamname',
  'name',
  'teams name',
  'teams list',
  'team list',
  'team names',
])

export default function ImportTeamsModal({ isOpen, onClose, onSuccess }: Props) {
  const [parsedTeams, setParsedTeams] = useState<ParsedTeam[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [dragActive, setDragActive] = useState(false)
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file')
  const [pastedText, setPastedText] = useState('')
  const [selectedRound, setSelectedRound] = useState<number>(1)
  const [selectedGroup, setSelectedGroup] = useState<number>(1)
  const [isCustomGroup, setIsCustomGroup] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)


  const processRawNames = (names: string[], sourceName: string) => {
    setError(null)
    setImportResult(null)

    const cleaned: string[] = []
    for (let i = 0; i < names.length; i++) {
      const raw = names[i].trim()
      if (!raw) continue

      // If line 0 matches a known header, skip it
      if (i === 0 && COMMON_HEADERS.has(raw.toLowerCase())) {
        continue
      }
      cleaned.push(raw)
    }

    if (cleaned.length === 0) {
      setError(`No team names found in ${sourceName}. Make sure each row contains a team name.`)
      setParsedTeams([])
      return
    }

    // Deduplicate within the file
    const uniqueNames: ParsedTeam[] = []
    const seen = new Set<string>()

    for (const name of cleaned) {
      const lower = name.toLowerCase()
      if (!seen.has(lower)) {
        seen.add(lower)
        uniqueNames.push({
          name,
          tag: autoGenerateTag(name),
        })
      }
    }

    setParsedTeams(uniqueNames)
    setFileName(sourceName)
  }

  const handleFileUpload = async (file: File) => {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()

      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          setError('The uploaded Excel file contains no worksheets.')
          return
        }
        const worksheet = workbook.Sheets[sheetName]
        const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

        const rawNames: string[] = []
        for (const row of rows) {
          if (!Array.isArray(row)) continue
          // Find first non-empty cell in row
          const cell = row.find((c) => String(c).trim().length > 0)
          if (cell !== undefined && cell !== null) {
            rawNames.push(String(cell).trim())
          }
        }
        processRawNames(rawNames, file.name)
      } else {
        // CSV or TXT file
        const text = await file.text()
        const lines = text.split(/\r?\n/)
        const rawNames: string[] = []

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          // If line has comma, take first value, stripping quotes
          const firstVal = trimmed.split(',')[0].replace(/^["']|["']$/g, '').trim()
          if (firstVal) {
            rawNames.push(firstVal)
          }
        }
        processRawNames(rawNames, file.name)
      }
    } catch (err) {
      setError(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleParseText = () => {
    const lines = pastedText.split(/\r?\n/)
    processRawNames(lines, 'pasted text')
  }

  const handleTeamTagChange = (index: number, newTag: string) => {
    setParsedTeams((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], tag: newTag.toUpperCase().slice(0, 8) }
      return next
    })
  }

  const handleTeamNameChange = (index: number, newName: string) => {
    setParsedTeams((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], name: newName }
      return next
    })
  }

  const handleRemoveTeam = (index: number) => {
    setParsedTeams((prev) => prev.filter((_, i) => i !== index))
  }

  const handleImport = () => {
    if (parsedTeams.length === 0) return
    setError(null)
    setImportResult(null)

    startTransition(async () => {
      const res = await importTeamsBatch(parsedTeams, selectedRound, selectedGroup)
      if (res.success) {
        setImportResult(
          `✓ Imported ${res.imported} teams for Round ${selectedRound} · Group ${selectedGroup}!${
            res.skipped > 0 ? ` (${res.skipped} already existed & were linked)` : ''
          }`
        )
        setTimeout(() => {
          onSuccess({ round: selectedRound, group: selectedGroup, count: res.imported })
          handleClose()
        }, 1200)
      } else {
        setError(res.error ?? 'Batch import failed.')
      }
    })
  }

  const handleDownloadSample = () => {
    const sampleRows = [
      'Team Name',
      'Team Soul',
      'GodLike Esports',
      'Blind Esports',
      'Global Esports',
      'Team XSpark',
      'Entity Gaming',
      'Reckoning Esports',
      'Medal Esports',
      'Team Insane',
      'Orangutan',
      'Big Brother Esports',
      'Team Tamilas',
      'Gujarat Tigers',
      'Hydra Official',
      'Autobotz Esports',
      'WindGod Esports',
    ].join('\n')

    const blob = new Blob([sampleRows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'sample_teams.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleClose = () => {
    setParsedTeams([])
    setFileName(null)
    setError(null)
    setImportResult(null)
    setPastedText('')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Excel or CSV of Team Names"
      size="lg"
    >
      <div className="form-stack">
        {/* Round and Group Destination Selectors */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            background: 'var(--clr-bg-2)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--clr-border)',
          }}
        >
          <div className="form-field">
            <label className="field-label" htmlFor="import-round">
              Assign to Round *
            </label>
            <select
              id="import-round"
              className="field-select"
              value={selectedRound}
              onChange={(e) => setSelectedRound(parseInt(e.target.value, 10))}
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
              <label className="field-label" htmlFor="import-group">
                Assign to Group * {isCustomGroup ? '(Custom)' : ''}
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
                id="import-group"
                className="field-select"
                value={selectedGroup}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setIsCustomGroup(true)
                  } else {
                    setSelectedGroup(parseInt(e.target.value, 10))
                  }
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
                  <option key={g} value={g}>Group {g}</option>
                ))}
                {selectedGroup > 8 && (
                  <option value={selectedGroup}>Group {selectedGroup}</option>
                )}
                <option value="custom">+ Other / Custom Group...</option>
              </select>
            ) : (
              <input
                id="import-group-custom"
                type="number"
                min="1"
                className="field-input"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(Math.max(1, parseInt(e.target.value, 10) || 1))}
                placeholder="Enter Group Number (e.g. 9, 10...)"
                autoFocus
              />
            )}
          </div>
        </div>

        {/* Toggle mode: Upload File vs Paste Text */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`btn btn--sm ${inputMode === 'file' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setInputMode('file')}
            >
              📁 Upload File (.xlsx / .csv)
            </button>
            <button
              type="button"
              className={`btn btn--sm ${inputMode === 'text' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setInputMode('text')}
            >
              📋 Paste Team Names
            </button>
          </div>

          <button
            type="button"
            className="btn btn--ghost btn--xs"
            onClick={handleDownloadSample}
            title="Download a ready-to-use CSV template with 16 team names"
          >
            📥 Download Sample CSV
          </button>
        </div>


        {/* Mode 1: File Dropzone */}
        {inputMode === 'file' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? 'var(--clr-accent)' : 'var(--clr-border-2)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '24px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragActive ? 'rgba(245, 158, 11, 0.05)' : 'var(--clr-bg-2)',
              transition: 'all var(--ease-std)',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv, .txt"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
            <p style={{ fontWeight: 600, color: 'var(--clr-text)', fontSize: '14px', marginBottom: '4px' }}>
              {fileName ? `Selected: ${fileName}` : 'Click to browse or drag & drop Excel / CSV file'}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--clr-text-3)' }}>
              Supports <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong>, or <strong>.txt</strong> — only team names are needed (one per row).
            </p>
          </div>
        )}

        {/* Mode 2: Paste Text */}
        {inputMode === 'text' && (
          <div className="form-field">
            <label className="field-label" htmlFor="paste-area">
              Paste team names (one per line):
            </label>
            <textarea
              id="paste-area"
              rows={6}
              className="field-input"
              style={{ height: 'auto', resize: 'vertical', fontFamily: 'monospace' }}
              placeholder={`Team Soul\nGodLike Esports\nBlind Esports\nGlobal Esports\nTeam XSpark`}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              style={{ alignSelf: 'flex-start', marginTop: '4px' }}
              onClick={handleParseText}
              disabled={!pastedText.trim()}
            >
              Parse Team Names
            </button>
          </div>
        )}

        {/* Feedback Messages */}
        {error && <p className="form-error" role="alert">{error}</p>}
        {importResult && <p className="form-info" role="status" style={{ color: 'var(--clr-green)' }}>{importResult}</p>}

        {/* Preview Table of Parsed Teams */}
        {parsedTeams.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--clr-text)' }}>
                  Preview Teams
                </span>
                <span className="tag-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--clr-accent)' }}>
                  {parsedTeams.length} Teams Detected
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--clr-text-3)' }}>
                You can adjust tags or names before importing
              </span>
            </div>

            <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-sm)' }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Team Name</th>
                    <th style={{ width: '120px' }}>Tag</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedTeams.map((team, idx) => (
                    <tr key={idx}>
                      <td style={{ color: 'var(--clr-text-3)', fontSize: '11px' }}>{idx + 1}</td>
                      <td>
                        <input
                          type="text"
                          className="field-input"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          value={team.name}
                          onChange={(e) => handleTeamNameChange(idx, e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="field-input"
                          style={{ padding: '4px 8px', fontSize: '12px', textTransform: 'uppercase' }}
                          maxLength={8}
                          value={team.tag}
                          onChange={(e) => handleTeamTagChange(idx, e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn--danger-ghost btn--xs"
                          onClick={() => handleRemoveTeam(idx)}
                          title="Remove team from import list"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="form-actions" style={{ marginTop: '16px' }}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleImport}
            disabled={parsedTeams.length === 0 || isPending}
            aria-busy={isPending}
          >
            {isPending ? 'Importing…' : `Import ${parsedTeams.length} Teams`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
