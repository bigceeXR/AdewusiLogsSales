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

    // 3. FETCH LIVE SERVER 4 MAPPINGS DYNAMICALLY
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

    const targetCountry = String(country_id).trim().toLowerCase();
    const targetService = String(service_id).trim().toLowerCase();

    // Universal helper: Checks if ANY property in the object matches your target string
    const matchAnyProperty = (item, target) => {
      if (!item || typeof item !== 'object') return false;
      return Object.values(item).some(val => {
        if (val === null || val === undefined) return false;
        const valStr = String(val).toLowerCase();
        return valStr === target || valStr.includes(target);
      });
    };

    const countriesList = Array.isArray(countriesData.data) ? countriesData.data : (countriesData.result || []);
    const servicesList = Array.isArray(servicesData.data) ? servicesData.data : (servicesData.result || []);

    const matchedCountry = countriesList.find(c => matchAnyProperty(c, targetCountry));
    const matchedService = servicesList.find(s => matchAnyProperty(s, targetService));

    if (!matchedCountry || !matchedService) {
      console.error('Mapping failed. Countries received:', countriesList);
      console.error('Services received:', servicesList);
      return res.status(400).json({
        success: false,
        error: `Universal mapping failed for country '${country_id}' or service '${service_id}'. Check Vercel logs.`
      });
    }

    // Extract the integer ID dynamically from whatever property holds it (id, country_id, service_id, etc.)
    const liveCountryIntId = parseInt(matchedCountry.id || matchedCountry.country_id || Object.values(matchedCountry).find(v => typeof v === 'number'), 10);
    const liveServiceIntId = parseInt(matchedService.id || matchedService.service_id || Object.values(matchedService).find(v => typeof v === 'number'), 10);

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