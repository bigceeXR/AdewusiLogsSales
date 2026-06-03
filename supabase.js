// supabase.js — fetches keys from /api/config, never exposes them in source
let sb;

async function initSupabase() {
  if (window.sb) return window.sb;
  try {
    const res = await fetch('/api/config');
    const env = await res.json();
    const { createClient } = supabase;
    window.sb = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    window.__PAYSTACK_KEY__ = env.PAYSTACK_KEY;
    sb = window.sb;
  } catch(e) {
    console.error('Failed to init Supabase:', e);
  }
  return window.sb;
}
