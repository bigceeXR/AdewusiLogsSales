// api/webhook.js — Node.js runtime, uses fetch REST instead of supabase npm
export const config = { runtime: 'nodejs' };

import { createHmac } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Read raw body for signature verification
  const body = JSON.stringify(req.body);
  const signature = req.headers['x-paystack-signature'];

  // Verify request is genuinely from Paystack
  const hash = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex');

  if (hash !== signature) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;

  // Only handle successful charges
  if (event.event !== 'charge.success') {
    return res.status(200).send('OK');
  }

  const { reference, amount } = event.data;

  // Helper: Supabase REST fetch
  async function sbGet(path) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    return r.json();
  }

  async function sbPost(path, data) {
    return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    });
  }

  async function sbPatch(path, data) {
    return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    });
  }

  // Get pending order
  const orders = await sbGet(`pending_orders?ref=eq.${reference}&select=*`);
  const order = orders?.[0];

  if (!order) {
    console.error('Order not found for ref:', reference);
    return res.status(404).send('Order not found');
  }

  // Verify amount matches
  if (order.amount_kobo !== amount) {
    console.error(`Amount mismatch! Expected ${order.amount_kobo}, got ${amount}`);
    return res.status(400).send('Amount mismatch');
  }

  // Check not already processed
  const existing = await sbGet(`purchases?paystack_ref=eq.${reference}&select=id&limit=1`);
  if (existing?.length > 0) return res.status(200).send('Already processed');

  // Process each cart item
  const cart = Array.isArray(order.cart) ? order.cart : JSON.parse(order.cart);

  for (const item of cart) {
    // Find unsold credential
    const creds = await sbGet(
      `account_credentials?account_id=eq.${item.id}&is_sold=eq.false&select=id&limit=1`
    );
    const cred = creds?.[0];

    // Insert purchase rows
    for (let q = 0; q < item.qty; q++) {
      await sbPost('purchases', {
        user_id: order.user_id,
        account_id: item.id,
        credential_id: cred?.id || null,
        quantity: 1,
        total_paid: item.price,
        paystack_ref: reference,
        is_completed: true
      });
    }

    // Mark credential as sold
    if (cred) {
      await sbPatch(`account_credentials?id=eq.${cred.id}`, { is_sold: true });
    }

    // Reduce stock
    const accts = await sbGet(`accounts?id=eq.${item.id}&select=quantity_available`);
    const current = accts?.[0]?.quantity_available || 0;
    await sbPatch(`accounts?id=eq.${item.id}`, {
      quantity_available: Math.max(0, current - item.qty)
    });
  }

  // Mark order complete
  await sbPatch(`pending_orders?ref=eq.${reference}`, { is_completed: true });

  console.log('Purchase recorded for ref:', reference);
  return res.status(200).send('OK');
}
