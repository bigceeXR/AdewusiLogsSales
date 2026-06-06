// api/webhook.js
// Paystack calls this after every payment
// Verifies signature, records purchase, assigns credentials

import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

export const config = { runtime: 'nodejs' }; // needs crypto — use nodejs runtime

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const body = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  // Verify the request is genuinely from Paystack
  const hash = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex');

  if (hash !== signature) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);

  // Only handle successful charges
  if (event.event !== 'charge.success') {
    return new Response('OK', { status: 200 });
  }

  const { reference, amount, customer } = event.data;

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get the pending order we saved during initiation
  const { data: order, error: orderErr } = await sb
    .from('pending_orders')
    .select('*')
    .eq('ref', reference)
    .single();

  if (orderErr || !order) {
    console.error('Order not found for ref:', reference);
    return new Response('Order not found', { status: 404 });
  }

  // Verify amount matches what we calculated server-side
  if (order.amount_kobo !== amount) {
    console.error(`Amount mismatch! Expected ${order.amount_kobo}, got ${amount}`);
    return new Response('Amount mismatch', { status: 400 });
  }

  // Check not already processed (prevent duplicate webhook calls)
  const { data: existing } = await sb
    .from('purchases')
    .select('id')
    .eq('paystack_ref', reference)
    .single();

  if (existing) {
    return new Response('Already processed', { status: 200 });
  }

  // Process each item in the cart
  const cart = JSON.parse(order.cart);

  for (const item of cart) {
    // Find unsold credential
    const { data: cred } = await sb
      .from('account_credentials')
      .select('id')
      .eq('account_id', item.id)
      .eq('is_sold', false)
      .limit(1)
      .single();

    // Record purchase
    for (let q = 0; q < item.qty; q++) {
      await sb.from('purchases').insert({
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
      await sb.from('account_credentials')
        .update({ is_sold: true })
        .eq('id', cred.id);
    }

    // Reduce stock
    await sb.from('accounts')
      .update({ quantity_available: sb.rpc('greatest', { a: 0, b: item.qty }) })
      .eq('id', item.id);
  }

  // Mark order as completed
  await sb.from('pending_orders')
    .update({ is_completed: true })
    .eq('ref', reference);

  console.log('Purchase recorded for ref:', reference);
  return new Response('OK', { status: 200 });
}