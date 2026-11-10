export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { reference, service_id, country_id, server, user_id } = req.body;

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

    // 3. FETCH LIVE SERVER 4 DATA
    const [countriesRes, servicesRes] = await Promise.all([
      fetch('https://xclusiveplugs.com/api/v1/numbers/countries?server=4', {
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}` }
      }),
      fetch('https://xclusiveplugs.com/api/v1/numbers/services?server=4', {
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}` }
      })
    ]);

    const countriesJson = await countriesRes.json();
    const servicesJson = await servicesRes.json();

    const extractArray = (obj) => {
      if (Array.isArray(obj)) return obj;
      if (Array.isArray(obj?.data)) return obj.data;
      if (Array.isArray(obj?.result)) return obj.result;
      return Object.values(obj || {}).find(v => Array.isArray(v)) || [];
    };

    const countriesList = extractArray(countriesJson);
    const servicesList = extractArray(servicesJson);

    // Normalizer to strip spaces, symbols, and parentheses (e.g. "USA (1)" -> "usa")
    const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const targetCountryInput = String(country_id).trim().toLowerCase();
    const targetServiceInput = String(service_id).trim().toLowerCase();

    // Define smart aliases for common countries to handle UK, USA, etc. perfectly
    const countryAliases = {
      'us': ['unitedstates', 'usa', 'us', 'america'],
      'usa': ['unitedstates', 'usa', 'us', 'america'],
      'united states': ['unitedstates', 'usa', 'us', 'america'],
      'uk': ['unitedkingdom', 'uk', 'britain', 'greatbritain', 'england'],
      'united kingdom': ['unitedkingdom', 'uk', 'britain', 'greatbritain', 'england'],
      'ng': ['nigeria', 'ng'],
      'nigeria': ['nigeria', 'ng'],
      'ca': ['canada', 'ca'],
      'canada': ['canada', 'ca']
    };

    const allowedCountryKeywords = countryAliases[targetCountryInput] || [normalize(targetCountryInput)];

    // Find Country using smart matching
    const matchedCountry = countriesList.find(c => {
      const objValuesStr = Object.values(c).map(v => normalize(v)).join(' ');
      return allowedCountryKeywords.some(keyword => objValuesStr.includes(keyword));
    });

    // Find Service using smart matching
    const matchedService = servicesList.find(s => {
      const objValuesStr = Object.values(s).map(v => normalize(v)).join(' ');
      const normalizedTargetService = normalize(targetServiceInput);
      return objValuesStr.includes(normalizedTargetService);
    });

    if (!matchedCountry || !matchedService) {
      console.error(`Smart mapping failed for Country: '${country_id}', Service: '${service_id}'`);
      return res.status(400).json({
        success: false,
        error: `Could not match country '${country_id}' or service '${service_id}' with Server 4 directory.`
      });
    }

    // Extract exact integer IDs dynamically from the matched objects
    const liveCountryIntId = parseInt(matchedCountry.id || matchedCountry.country_id || Object.values(matchedCountry).find(v => typeof v === 'number'), 10);
    const liveServiceIntId = parseInt(matchedService.id || matchedService.service_id || Object.values(matchedService).find(v => typeof v === 'number'), 10);

    // 4. Place order on Server 4
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