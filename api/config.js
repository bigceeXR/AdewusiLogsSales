// api/config.js — Vercel Edge Function
export const config = { runtime: 'edge' };

export default function handler(req) {
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const allowed = process.env.SITE_URL || '';

  // Block direct browser visits — only serve to requests from your domain
  const isAllowed = origin.includes(allowed) || referer.includes(allowed);

  if (!isAllowed) {
    return new Response('Forbidden', { status: 403 });
  }

  const data = JSON.stringify({
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    PAYSTACK_KEY: process.env.NEXT_PUBLIC_PAYSTACK_KEY
  });

  return new Response(data, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowed
    }
  });
}