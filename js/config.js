const SUPABASE_URL = "https://leiojjsjvjkywfwpoxfk.supabase.co"; 
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_m5jgEBI5x3TmxqvuFlC6jg_OrMASPIQ"; 

const isSupabaseConfigured =
  Boolean(window.supabase) &&
  !SUPABASE_URL.startsWith("YOUR_") &&
  !SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_");

let supabaseClient = null;

if (isSupabaseConfigured) {
  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
      },
    },
  );
} else {
  console.warn(
    "Supabase is not configured. Add your project URL and publishable key to js/config.js.",
  );
}
