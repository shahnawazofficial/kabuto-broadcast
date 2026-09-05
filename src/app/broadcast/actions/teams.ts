'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean
  error?: string
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createTeam(formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string)?.trim()
  const tag  = (formData.get('tag')  as string)?.trim()
  const logo_url = (formData.get('logo_url') as string)?.trim() || null

  if (!name) return { success: false, error: 'Team name is required.' }
  if (!tag)  return { success: false, error: 'Team tag is required.' }

  const supabase = await createClient()
  const { error } = await supabase.from('teams').insert({ name, tag, logo_url })

  if (error) return { success: false, error: error.message }

  revalidatePath('/broadcast')
  return { success: true }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateTeam(formData: FormData): Promise<ActionResult> {
  const id   = (formData.get('id')   as string)?.trim()
  const name = (formData.get('name') as string)?.trim()
  const tag  = (formData.get('tag')  as string)?.trim()
  const logo_url = (formData.get('logo_url') as string)?.trim() || null

  if (!id)   return { success: false, error: 'Team ID is missing.' }
  if (!name) return { success: false, error: 'Team name is required.' }
  if (!tag)  return { success: false, error: 'Team tag is required.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('teams')
    .update({ name, tag, logo_url })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/broadcast')
  return { success: true }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteTeam(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: 'Team ID is missing.' }

  const supabase = await createClient()
  const { error } = await supabase.from('teams').delete().eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/broadcast')
  return { success: true }
}

// ─── Seed demo data ───────────────────────────────────────────────────────────

const DEMO_TEAMS = [
  { name: 'Soul Esports',      tag: 'SOUL' },
  { name: 'Skylightz Gaming',  tag: 'SKYLZ' },
  { name: 'OR Esports',        tag: 'OR' },
  { name: 'Global Esports',    tag: 'GE' },
  { name: 'Team XSpark',       tag: 'XSP' },
]

const DEMO_PLAYERS: Record<string, { name: string; ign: string }[]> = {
  'Soul Esports':     [{ name: 'Tanmay Singh',   ign: 'Neyoo'     }, { name: 'Abhishek Choudhary', ign: 'Viper'    }, { name: 'Harpreet Jangra', ign: 'ClutchGod' }, { name: 'Aniket Pandit', ign: 'Omega'  }],
  'Skylightz Gaming': [{ name: 'Sagar Thakur',   ign: 'Mavi'      }, { name: 'Ronit Yadav',        ign: 'Rony'     }, { name: 'Sagar Mishra',    ign: 'Ghost'     }, { name: 'Hyder Ali',     ign: 'Hyder' }],
  'OR Esports':       [{ name: 'Mohammad Owais', ign: 'Owais'     }, { name: 'Zbigniew Guzman',    ign: 'Zgod'     }, { name: 'Harpreet Gill',   ign: 'Gill'      }, { name: 'Jonathan',      ign: 'Jonathan' }],
  'Global Esports':   [{ name: 'Abhijeet Andhale', ign: 'Destro'  }, { name: 'Mayank Jain',        ign: 'Insane'   }, { name: 'Shawn Lal',       ign: 'Shawn'     }, { name: 'Alpha Singh',   ign: 'Alpha' }],
  'Team XSpark':      [{ name: 'Zbigniew Guzman',  ign: 'Zgod'    }, { name: 'Axom Singh',          ign: 'Axom'    }, { name: 'Rexus Malhotra',  ign: 'Rexy'      }, { name: 'Karna Pal',     ign: 'Karna' }],
}

export async function seedDemoData(): Promise<ActionResult> {
  const supabase = await createClient()

  // Fetch existing team names to avoid duplicates
  const { data: existingTeams } = await supabase.from('teams').select('name')
  const existingNames = new Set((existingTeams ?? []).map((t) => t.name))

  const teamsToInsert = DEMO_TEAMS.filter((t) => !existingNames.has(t.name))

  if (teamsToInsert.length === 0) {
    return { success: true, error: 'Demo data already exists — nothing inserted.' }
  }

  // Insert teams
  const { data: insertedTeams, error: teamErr } = await supabase
    .from('teams')
    .insert(teamsToInsert)
    .select()

  if (teamErr) return { success: false, error: teamErr.message }

  // Insert players for each newly created team
  const playerRows = (insertedTeams ?? []).flatMap((team) => {
    const players = DEMO_PLAYERS[team.name] ?? []
    return players.map((p) => ({ ...p, team_id: team.id }))
  })

  if (playerRows.length > 0) {
    const { error: playerErr } = await supabase.from('players').insert(playerRows)
    if (playerErr) return { success: false, error: playerErr.message }
  }

  revalidatePath('/broadcast')
  return { success: true }
}
