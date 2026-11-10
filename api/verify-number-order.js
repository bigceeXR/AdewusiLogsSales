export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { reference, service_id, country_id, server, user_id } = req.body;

  if (!reference || !service_id || !country_id || !user_id) {
    return res.status(400).json({ success: false, error: 'Missing required order details' });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
  const XCLUSIVEPLUGS_KEY = process.env.XCLUSIVEPLUGS_API_KEY;

  try {
    // 1. Verify Paystack transaction
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
    });
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data.status !== 'success') {
      return res.status(400).json({ success: false, error: 'Payment verification failed by Paystack' });
    }

    // 2. Normalize IDs to lowercase to match database entries securely
    const cleanServiceId = String(service_id).trim().toLowerCase();
    const cleanCountryId = String(country_id).trim().toLowerCase();

    // 3. Fetch price exclusively from number_country_prices table
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/number_country_prices?service_id=eq.${cleanServiceId}&country_id=eq.${cleanCountryId}&select=price_ngn`,
      {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      }
    );
    const rows = await dbRes.json();
    const priceItem = rows?.[0];

    // Fallback price (₦2,500) if row hasn't been explicitly added to Supabase yet
    const exactPriceNgn = priceItem ? Number(priceItem.price_ngn) : 2500; 
    const expectedAmountKobo = Math.round(exactPriceNgn * 100);

    // Allow a small buffer for test currency conversions if needed, but ensure it matches closely
    if (paystackData.data.amount < expectedAmountKobo) {
      return res.status(400).json({ 
        success: false, 
        error: `Price mismatch: Paid ₦${paystackData.data.amount / 100}, expected ₦${exactPriceNgn}` 
      });
    }

    // 4. Purchase virtual number from Server 4
    const idempotencyKey = 'order_' + reference;
    const xclusiveRes = await fetch('https://xclusiveplugs.com/api/v1/numbers/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}`
      },
      body: JSON.stringify({
        service_id: cleanServiceId,
        country_id: cleanCountryId,
        server: server || 4,
        idempotency_key: idempotencyKey
      })
    });

    const xclusiveData = await xclusiveRes.json();

    if (!xclusiveRes.ok || !xclusiveData.success) {
      return res.status(400).json({
        success: false,
        error: xclusiveData.message || 'Server 4 is out of stock for this country selection'
      });
    }

    const phoneNumber = xclusiveData.data.phone_number || xclusiveData.data.number;
    const orderId = xclusiveData.data.order_id || reference;

    // 5. Save purchase record to Supabase purchases table
    await fetch(`${SUPABASE_URL}/rest/v1/purchases`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: user_id,
        quantity: 1,
        total_paid: exactPriceNgn,
        paystack_ref: reference,
        is_completed: true,
        metadata: {
          service_name: cleanServiceId,
          country_id: cleanCountryId,
          phone_number: phoneNumber,
          order_id: orderId
        }
      })
    });

    return res.status(200).json({
      success: true,
      phone_number: phoneNumber,
      order_id: orderId
    });

  } catch (err) {
    console.error('Order verification error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error processing order' });
  }
}