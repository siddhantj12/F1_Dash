import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Initialize Supabase client
// These are usually public anon keys, so it's safe to have them in the frontend
// but ideally they'd be injected or fetched from an endpoint.
const supabaseUrl = 'https://fnocabpmplyjfwswrpob.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZub2NhYnBtcGx5amZ3c3dycG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyODEyNzcsImV4cCI6MjA2NTg1NzI3N30.ILSBclGorcyaB2NTZ1RvZlP62g7uaKmKQIEEGd4iID4'

export const supabase = createClient(supabaseUrl, supabaseKey)
