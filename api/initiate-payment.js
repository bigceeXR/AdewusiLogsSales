// api/initiate-payment.js
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Manually parse body if needed
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const { cart, userId, email } = body || {};

    if (!cart || !Array.isArray(cart) || !userId || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        received: { cart: !!cart, userId: !!userId, email: !!email }
      });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: 'Server config missing' });
    }

    // Fetch real prices — use `in` filter syntax for multiple ids
    const ids = cart.map(i => i.id).join(',');
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/accounts?id=in.(${ids})&select=id,price_ngn,quantity_available,platform`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      }
    );

    const accounts = await dbRes.json();

    if (!Array.isArray(accounts)) {
      return res.status(500).json({ error: 'Could not verify prices', detail: accounts });
    }

    // Calculate server-side total — browser prices are ignored
    let totalKobo = 0;
    const verifiedItems = [];

    for (const cartItem of cart) {
      const dbItem = accounts.find(a => a.id === cartItem.id);
      if (!dbItem) return res.status(400).json({ error: `Account not found: ${cartItem.id}` });
      if (dbItem.quantity_available < cartItem.qty) {
        return res.status(400).json({ error: `Not enough stock for ${dbItem.platform}` });
      }
      totalKobo += dbItem.price_ngn * cartItem.qty * 100;
      verifiedItems.push({ ...cartItem, price: dbItem.price_ngn });
    }

    // Generate unique reference
    const ref = 'PL_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase();

    // Save pending order
    const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/pending_orders`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        ref,
        user_id: userId,
        email,
        amount_kobo: totalKobo,
        cart: verifiedItems
      })
    });

    if (!orderRes.ok) {
      const detail = await orderRes.text();
      return res.status(500).json({ error: 'Could not save order', detail });
    }

    return res.status(200).json({
      ref,
      amount: totalKobo,
      email,
      key: process.env.NEXT_PUBLIC_PAYSTACK_KEY
    });

  } catch (err) {
    console.error('initiate-payment error:', err);
    return res.status(500).json({ error: err.message });
  }
}
