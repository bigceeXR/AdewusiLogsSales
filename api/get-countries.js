export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const server = req.query.server || 4;
    const XCLUSIVEPLUGS_KEY = process.env.XCLUSIVEPLUGS_API_KEY;

    try {
        const response = await fetch(`https://xclusiveplugs.com/api/v1/numbers/countries?server=${server}`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}`
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            return res.status(200).json({ success: true, data: data.data });
        } else {
            return res.status(400).json({ success: false, error: data.message || 'Failed to fetch countries' });
        }
    } catch (err) {
        console.error('Countries Proxy Error:', err);
        return res.status(500).json({ success: false, error: 'Internal server error fetching countries' });
    }
}