// api/config.js — Vercel Edge Function
// Returns public config to the browser without exposing keys in env.js
export const config = { runtime: 'edge' };

export default function handler(req) {
  const data = JSON.stringify({
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    PAYSTACK_KEY: process.env.NEXT_PUBLIC_PAYSTACK_KEY
  });

  return new Response(data, {
    headers: {
      'Content-Type': 'application/json',
      // Only your domain can call this
      'Access-Control-Allow-Origin': process.env.SITE_URL || '*'
    }
  });
}
