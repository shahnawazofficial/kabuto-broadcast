import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * Supabase browser client — use in Client Components ('use client').
 * Includes safe fallback URL if environment variables are not yet configured.
 */
export function createClient() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const validUrl = envUrl && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))
    ? envUrl
    : 'https://slgyvivvdagayvwrmztl.supabase.co'

  const validKey = envKey && envKey.length > 5
    ? envKey
    : 'sb_publishable_tmXCPs6_KoBSh4PsbXqePw_Au4421kM'

  return createBrowserClient<Database>(validUrl, validKey)
}
