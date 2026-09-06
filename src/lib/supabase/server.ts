import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * Supabase server client — use in Server Components, Route Handlers, and Server Actions.
 * Reads and writes cookies via next/headers so session state persists across requests.
 */
export async function createClient() {
  const cookieStore = await cookies()

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const validUrl = envUrl && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))
    ? envUrl
    : 'https://slgyvivvdagayvwrmztl.supabase.co'

  const validKey = envKey && envKey.length > 5
    ? envKey
    : 'sb_publishable_tmXCPs6_KoBSh4PsbXqePw_Au4421kM'

  return createServerClient<Database>(
    validUrl,
    validKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — safe to ignore.
            // If auth is needed, add middleware to refresh sessions.
          }
        },
      },
    }
  )
}
