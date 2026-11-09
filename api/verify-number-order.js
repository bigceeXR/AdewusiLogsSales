export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { reference, service_id, country_id, server, email, user_id } = req.body;
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
        // 1. Verify Paystack transaction
        const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
        });
        const paystackData = await paystackRes.json();

        if (!paystackData.status || paystackData.data.status !== 'success') {
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        // 2. Fetch authoritative price from Supabase table
        // Fetch country-specific price from Supabase table
        const dbRes = await fetch(
            `${SUPABASE_URL}/rest/v1/number_country_prices?service_id=eq.${service_id}&country_id=eq.${country_id}&select=price_ngn`,
            {
                headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
            }
        );
        const rows = await dbRes.json();
        const priceItem = rows?.[0];

        const exactPriceNgn = priceItem ? priceItem.price_ngn : 2500; // Fallback price
        const expectedAmountKobo = Math.round(Number(exactPriceNgn) * 100);

        if (paystackData.data.amount < expectedAmountKobo) {
            return res.status(400).json({ success: false, error: 'Paid amount does not match country price' });
        }
        const [serviceItem] = await dbRes.json();

        if (!serviceItem) return res.status(400).json({ error: 'Invalid service selected' });

        // 3. Request Number from XclusivePlugs Server 4
        const idempotencyKey = 'order_' + reference;
        const xclusiveRes = await fetch('https://xclusiveplugs.com/api/v1/numbers/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.XCLUSIVEPLUGS_API_KEY}`
            },
            body: JSON.stringify({
                service_id,
                country_id: country_id || 'us',
                server: server || 4,
                idempotency_key: idempotencyKey
            })
        });

        const xclusiveData = await xclusiveRes.json();

        if (!xclusiveRes.ok || !xclusiveData.success) {
            return res.status(400).json({ success: false, message: xclusiveData.message || 'Server 4 out of stock' });
        }

        const phoneNumber = xclusiveData.data.phone_number || xclusiveData.data.number;
        const orderId = xclusiveData.data.order_id || reference;

        // 4. Save to user's purchases table so it appears on their dashboard
        // Save purchase record including metadata for the virtual number
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
                total_paid: serviceItem.price_ngn,
                paystack_ref: reference,
                is_completed: true,
                metadata: {
                    service_name: serviceItem.service_name,
                    phone_number: phoneNumber
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
        return res.status(500).json({ error: err.message });
    }
}