import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

if (!supabaseConfigured) {
  // Deliberately not thrown — the app renders a clear "not configured"
  // screen instead (see App.tsx) so a missing .env doesn't just show a
  // blank white page with an error buried in the console.
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.'
  )
}

// Falls back to placeholder strings when not configured so createClient
// itself doesn't throw at import time — supabaseConfigured is what the app
// actually checks before doing anything with this client.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key'
)
