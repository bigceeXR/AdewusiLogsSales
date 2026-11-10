export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { order_id, action, purchase_id } = req.body; // action: 'cancel' or 'report'
    const XCLUSIVEPLUGS_KEY = process.env.XCLUSIVEPLUGS_API_KEY;
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!order_id || !action || !purchase_id) {
        return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }

    try {
        // 1. Call Server 4 action endpoint (Cancel or Report issue)
        const endpoint = action === 'cancel'
            ? `https://xclusiveplugs.com/api/v1/numbers/orders/${order_id}/cancel`
            : `https://xclusiveplugs.com/api/v1/numbers/orders/${order_id}/report`;

        const apiRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}`
            }
        });

        const data = await apiRes.json();

        if (!apiRes.ok || !data.success) {
            return res.status(400).json({ success: false, error: data.message || `Failed to ${action} order on Server 4` });
        }

        // 2. Update status in Supabase metadata
        const newStatus = action === 'cancel' ? 'cancelled' : 'reported';

        await fetch(`${SUPABASE_URL}/rest/v1/purchases?id=eq.${purchase_id}`, {
            method: 'PATCH',
            headers: {
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                metadata: { status: newStatus, action_note: `${action} requested by user` }
            })
        });

        return res.status(200).json({ success: true, message: `Order successfully ${newStatus}.` });

    } catch (err) {
        console.error('Order action error:', err);
        return res.status(500).json({ success: false, error: 'Server error processing order action' });
    }
}