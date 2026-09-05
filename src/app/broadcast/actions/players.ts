'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ActionResult } from './teams'

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createPlayer(formData: FormData): Promise<ActionResult> {
  const name      = (formData.get('name')      as string)?.trim()
  const ign       = (formData.get('ign')       as string)?.trim()
  const team_id   = (formData.get('team_id')   as string)?.trim()
  const photo_url = (formData.get('photo_url') as string)?.trim() || null

  if (!name)    return { success: false, error: 'Player name is required.' }
  if (!ign)     return { success: false, error: 'IGN is required.' }
  if (!team_id) return { success: false, error: 'Team selection is required.' }

  const supabase = await createClient()
  const { error } = await supabase.from('players').insert({ name, ign, team_id, photo_url })

  if (error) return { success: false, error: error.message }

  revalidatePath('/broadcast')
  return { success: true }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updatePlayer(formData: FormData): Promise<ActionResult> {
  const id        = (formData.get('id')        as string)?.trim()
  const name      = (formData.get('name')      as string)?.trim()
  const ign       = (formData.get('ign')       as string)?.trim()
  const team_id   = (formData.get('team_id')   as string)?.trim()
  const photo_url = (formData.get('photo_url') as string)?.trim() || null

  if (!id)      return { success: false, error: 'Player ID is missing.' }
  if (!name)    return { success: false, error: 'Player name is required.' }
  if (!ign)     return { success: false, error: 'IGN is required.' }
  if (!team_id) return { success: false, error: 'Team selection is required.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('players')
    .update({ name, ign, team_id, photo_url })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/broadcast')
  return { success: true }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deletePlayer(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: 'Player ID is missing.' }

  const supabase = await createClient()
  const { error } = await supabase.from('players').delete().eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/broadcast')
  return { success: true }
}
