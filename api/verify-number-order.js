export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Frontend sends friendly slugs like country_id: "us", service_id: "whatsapp"
  const { reference, service_id, country_id, server, user_id } = req.body;

  if (!reference || !service_id || !country_id || !user_id) {
    return res.status(400).json({ success: false, error: 'Missing required order parameters' });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
  const XCLUSIVEPLUGS_KEY = process.env.XCLUSIVEPLUGS_API_KEY;

  try {
    // 1. Verify Paystack Payment
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
    });
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data.status !== 'success') {
      return res.status(400).json({ success: false, error: 'Payment verification failed' });
    }

    // 2. Fetch custom retail price from your Supabase table
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/number_country_prices?service_id=eq.${service_id}&country_id=eq.${country_id}&select=price_ngn`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );
    const rows = await dbRes.json();
    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Pricing rule not found in database' });
    }

    const priceNgn = Number(rows[0].price_ngn);
    const expectedKobo = Math.round(priceNgn * 100);

    if (paystackData.data.amount < expectedKobo) {
      return res.status(400).json({ success: false, error: 'Paid amount does not match database price' });
    }

    // 3. FETCH LIVE SERVER 4 MAPPINGS DYNAMICALLY WITH LOGGING
    const [countriesRes, servicesRes] = await Promise.all([
      fetch('https://xclusiveplugs.com/api/v1/numbers/countries?server=4', {
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}` }
      }),
      fetch('https://xclusiveplugs.com/api/v1/numbers/services?server=4', {
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}` }
      })
    ]);

    const countriesData = await countriesRes.json();
    const servicesData = await servicesRes.json();

    // Log the raw responses to Vercel console so you can inspect their exact structure if needed
    console.log('Server 4 Countries Sample:', countriesData.data?.[0]);
    console.log('Server 4 Services Sample:', servicesData.data?.[0]);

    const targetCountry = String(country_id).trim().toLowerCase();
    const targetService = String(service_id).trim().toLowerCase();

    // Flexible matching across all potential key names
    const matchedCountry = countriesData.data?.find(c => {
      const cId = String(c.id || '').toLowerCase();
      const cCode = String(c.code || c.short || c.iso || '').toLowerCase();
      const cName = String(c.name || '').toLowerCase();
      return cId === targetCountry || cCode === targetCountry || cName.includes(targetCountry);
    });

    const matchedService = servicesData.data?.find(s => {
      const sId = String(s.id || s.service_id || '').toLowerCase();
      const sCode = String(s.code || s.slug || '').toLowerCase();
      const sName = String(s.name || s.service_name || '').toLowerCase();
      return sId === targetService || sCode === targetService || sName.includes(targetService);
    });

    if (!matchedCountry || !matchedService) {
      return res.status(400).json({
        success: false,
        error: `Mapping failed for country '${country_id}' or service '${service_id}'. Check Vercel logs for raw Server 4 keys.`
      });
    }

    const liveCountryIntId = parseInt(matchedCountry.id || matchedCountry.country_id, 10);
    const liveServiceIntId = parseInt(matchedService.id || matchedService.service_id, 10);

    // 4. Place the order on Server 4 using their exact live integer IDs
    const xclusiveRes = await fetch('https://xclusiveplugs.com/api/v1/numbers/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}`
      },
      body: JSON.stringify({
        service_id: liveServiceIntId,
        country_id: liveCountryIntId,
        server: server || 4,
        idempotency_key: 'order_' + reference
      })
    });

    const xclusiveData = await xclusiveRes.json();

    if (!xclusiveRes.ok || !xclusiveData.success) {
      return res.status(400).json({
        success: false,
        error: xclusiveData.message || 'Server 4 is out of stock for this configuration'
      });
    }

    const phoneNumber = xclusiveData.data.phone_number || xclusiveData.data.number;
    const orderId = xclusiveData.data.order_id || reference;

    // 5. Save the completed order record to Supabase purchases table
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
        total_paid: priceNgn,
        paystack_ref: reference,
        is_completed: true,
        metadata: {
          service_name: service_id,
          country_id: country_id,
          phone_number: phoneNumber,
          order_id: orderId,
          status: 'active'
        }
      })
    });

    return res.status(200).json({
      success: true,
      phone_number: phoneNumber,
      order_id: orderId
    });

  } catch (err) {
    console.error('Order processing error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error during order fulfillment' });
  }
}