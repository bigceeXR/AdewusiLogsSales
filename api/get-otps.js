export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { order_id } = req.body;
    if (!order_id) {
        return res.status(400).json({ success: false, error: 'Missing order_id' });
    }

    const XCLUSIVEPLUGS_KEY = process.env.XCLUSIVEPLUGS_API_KEY;

    try {
        // Query XclusivePlugs Server 4 order status / messages endpoint
        const response = await fetch(`https://xclusiveplugs.com/api/v1/numbers/orders/${order_id}`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}`
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            return res.status(200).json({
                success: true,
                status: data.data.status, // e.g., 'pending', 'completed', 'canceled'
                sms: data.data.sms_text || data.data.code || null, // Incoming OTP or SMS message body
                full_sms_list: data.data.messages || []
            });
        } else {
            return res.status(400).json({ success: false, error: data.message || 'Could not fetch OTP status' });
        }

    } catch (err) {
        console.error('OTP Fetch Error:', err);
        return res.status(500).json({ success: false, error: 'Internal server error checking OTP' });
    }
}