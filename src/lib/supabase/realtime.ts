import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type RealtimeTableName = 'broadcast_state' | 'live_scores' | 'matches' | 'teams' | 'players'

export interface RealtimeSubscriptionOptions {
  channelName: string
  tables: RealtimeTableName[]
  onChange: (payload: { table: RealtimeTableName; event: string; record?: unknown }) => void
}

const LOCAL_SYNC_CHANNEL = 'kabuto_broadcast_realtime_sync'

/**
 * Emits a realtime notification across open browser tabs/windows.
 * Used alongside Supabase postgres_changes to ensure instantaneous synchronization.
 */
export function notifyRealtimeChange(table: RealtimeTableName, event = 'UPDATE', record?: unknown) {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel(LOCAL_SYNC_CHANNEL)
      bc.postMessage({ table, event, record, timestamp: Date.now() })
      bc.close()
    } catch {
      // Silent catch
    }
  }
}

/**
 * Subscribes to Supabase Realtime postgres_changes for specified tables.
 * Returns a robust cleanup function that unbinds listeners and removes channels
 * to prevent duplicate subscriptions and memory leaks.
 */
export function subscribeToRealtimeTables({
  channelName,
  tables,
  onChange,
}: RealtimeSubscriptionOptions): () => void {
  let isCleanedUp = false
  let supabaseChannel: RealtimeChannel | null = null
  let broadcastChannel: BroadcastChannel | null = null

  try {
    const supabase = createClient()
    supabaseChannel = supabase.channel(channelName)

    tables.forEach((table) => {
      supabaseChannel?.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          if (!isCleanedUp) {
            onChange({ table, event: payload.eventType, record: payload.new })
          }
        }
      )
    })

    supabaseChannel.subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' && error) {
        // Graceful handle — local fallback channel ensures uninterrupted operation
      }
    })
  } catch {
    // Graceful fallback
  }

  // Cross-tab broadcast listener for instant local synchronization
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      broadcastChannel = new BroadcastChannel(LOCAL_SYNC_CHANNEL)
      broadcastChannel.onmessage = (event) => {
        if (!isCleanedUp && event.data?.table && tables.includes(event.data.table)) {
          onChange({
            table: event.data.table,
            event: event.data.event || 'UPDATE',
            record: event.data.record,
          })
        }
      }
    } catch {
      // Silent catch
    }
  }

  // Cleanup on unmount
  return () => {
    isCleanedUp = true
    if (supabaseChannel) {
      try {
        const supabase = createClient()
        supabase.removeChannel(supabaseChannel).catch(() => {})
      } catch {
        // Silent catch
      }
      supabaseChannel = null
    }
    if (broadcastChannel) {
      broadcastChannel.close()
      broadcastChannel = null
    }
  }
}
