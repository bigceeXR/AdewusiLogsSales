export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const XCLUSIVEPLUGS_KEY = process.env.XCLUSIVEPLUGS_API_KEY;

    try {
        const [servicesRes, countriesRes] = await Promise.all([
            fetch('https://xclusiveplugs.com/api/v1/numbers/services?server=4', {
                headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}` }
            }),
            fetch('https://xclusiveplugs.com/api/v1/numbers/countries?server=4', {
                headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}` }
            })
        ]);

        const servicesData = await servicesRes.json();
        const countriesData = await countriesRes.json();

        return res.status(200).json({
            success: true,
            services: servicesData.success ? servicesData.data : [],
            countries: countriesData.success ? countriesData.data : []
        });

    } catch (err) {
        console.error('Server 4 Fetch Error:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch Server 4 inventory' });
    }
}