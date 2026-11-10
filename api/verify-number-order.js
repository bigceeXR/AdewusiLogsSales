export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { reference, service_id, country_id, user_id } = req.body;

  if (!reference || !service_id || !country_id || !user_id) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
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

    // 2. Fetch custom retail price from Supabase
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

    // 3. STEP A: Fetch Countries from XclusivePlugs
    const countriesRes = await fetch('https://xclusiveplugs.com/api/v1/numbers/countries', {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}` }
    });
    const countriesJson = await countriesRes.json();
    const countriesList = countriesJson.data || [];

    const targetCountryInput = String(country_id).trim().toLowerCase();

    // Alias mapper for common country inputs (us, uk, ng, etc.)
    const countryAliases = {
      'us': ['us', 'usa', 'united states', 'america'],
      'usa': ['us', 'usa', 'united states', 'america'],
      'uk': ['uk', 'united kingdom', 'britain', 'england'],
      'ng': ['ng', 'nigeria']
    };
    const allowedCountryKeywords = countryAliases[targetCountryInput] || [targetCountryInput];

    // Find the country object
    const matchedCountry = countriesList.find(c => {
      const shortCode = String(c.short || '').toLowerCase();
      const name = String(c.name || '').toLowerCase();
      return allowedCountryKeywords.some(kw => shortCode === kw || name.includes(kw));
    });

    if (!matchedCountry) {
      return res.status(400).json({ success: false, error: `Could not match country '${country_id}' with XclusivePlugs catalog.` });
    }

    const liveCountryId = matchedCountry.id; // e.g., "1"

    // 3. STEP B: Fetch Services for THIS specific country ID
    const servicesRes = await fetch(`https://xclusiveplugs.com/api/v1/numbers/services?country_id=${liveCountryId}`, {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}` }
    });
    const servicesJson = await servicesRes.json();
    const servicesList = servicesJson.data || [];

    const targetServiceInput = String(service_id).trim().toLowerCase();

    // Find the service object by matching name or ID
    const matchedService = servicesList.find(s => {
      const sName = String(s.service_name || s.name || '').toLowerCase();
      const sId = String(s.service_id || s.id || '').toLowerCase();
      return sName.includes(targetServiceInput) || sId === targetServiceInput;
    });

    if (!matchedService) {
      return res.status(400).json({ success: false, error: `Service '${service_id}' is currently unavailable for ${matchedCountry.name}.` });
    }

    const liveServiceId = matchedService.service_id || matchedService.id;

    // 4. Place order on XclusivePlugs Server
    const idempotencyKey = 'order_' + reference;
    const xclusiveRes = await fetch('https://xclusiveplugs.com/api/v1/numbers/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}`
      },
      body: JSON.stringify({
        country_id: Number(liveCountryId),
        service_id: Number(liveServiceId),
        idempotency_key: idempotencyKey
      })
    });

    const xclusiveData = await xclusiveRes.json();

    if (!xclusiveRes.ok || !xclusiveData.success) {
      return res.status(400).json({
        success: false,
        error: xclusiveData.message || 'Server is out of stock for this configuration'
      });
    }

    const phoneNumber = xclusiveData.data.phone_number || xclusiveData.data.number;
    const orderId = xclusiveData.data.order_id || reference;

    // 5. Save record to Supabase purchases table
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