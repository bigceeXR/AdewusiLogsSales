// api/initiate-payment.js
// Called by frontend before opening Paystack
// Reads prices from DB so browser can never fake the amount

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { cart, userId, email } = await req.json();

    if (!cart || !userId || !email) {
      return json({ error: 'Missing required fields' }, 400);
    }

    // Init Supabase with service role — full DB access
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch real prices from DB for every item in cart
    const ids = cart.map(i => i.id);
    const { data: accounts, error } = await sb
      .from('accounts')
      .select('id, price_ngn, quantity_available, platform')
      .in('id', ids);

    if (error || !accounts) return json({ error: 'Could not verify prices' }, 500);

    // Calculate server-side total — browser total is ignored
    let totalKobo = 0;
    const verifiedItems = [];

    for (const cartItem of cart) {
      const dbItem = accounts.find(a => a.id === cartItem.id);
      if (!dbItem) return json({ error: `Account ${cartItem.id} not found` }, 400);
      if (dbItem.quantity_available < cartItem.qty) {
        return json({ error: `Not enough stock for ${dbItem.platform}` }, 400);
      }
      const itemTotal = dbItem.price_ngn * cartItem.qty;
      totalKobo += itemTotal * 100; // convert to kobo
      verifiedItems.push({ ...cartItem, price: dbItem.price_ngn });
    }

    // Generate unique reference
    const ref = 'PL_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase();

    // Save pending order to DB so webhook can verify it
    await sb.from('pending_orders').insert({
      ref,
      user_id: userId,
      email,
      amount_kobo: totalKobo,
      cart: JSON.stringify(verifiedItems)
    });

    return json({
      ref,
      amount: totalKobo,
      email,
      key: process.env.NEXT_PUBLIC_PAYSTACK_KEY
    });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}