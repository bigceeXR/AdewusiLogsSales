export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const XCLUSIVEPLUGS_KEY = process.env.XCLUSIVEPLUGS_API_KEY;

    // Curated fallback services matching typical Server 4 stock
    const fallbackServices = [
        { id: 'whatsapp', name: 'WhatsApp', category: 'messaging' },
        { id: 'telegram', name: 'Telegram', category: 'messaging' },
        { id: 'openai', name: 'OpenAI / ChatGPT', category: 'ai' },
        { id: 'instagram', name: 'Instagram', category: 'social' },
        { id: 'facebook', name: 'Facebook', category: 'social' },
        { id: 'twitter', name: 'Twitter / X', category: 'social' },
        { id: 'google', name: 'Google / Gmail', category: 'messaging' }
    ];

    const fallbackCountries = [
        { id: 'us', name: 'United States', calling_code: '1' },
        { id: 'uk', name: 'United Kingdom', calling_code: '44' },
        { id: 'ca', name: 'Canada', calling_code: '1' },
        { id: 'ng', name: 'Nigeria', calling_code: '234' }
    ];

    try {
        const [servicesRes, countriesRes] = await Promise.all([
            fetch('https://xclusiveplugs.com/api/v1/numbers/services?server=4', {
                headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}` }
            }),
            fetch('https://xclusivepluss.com/api/v1/numbers/countries?server=4', {
                headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${XCLUSIVEPLUGS_KEY}` }
            })
        ]);

        const servicesData = servicesRes.ok ? await servicesRes.json() : { success: false };
        const countriesData = countriesRes.ok ? await countriesRes.json() : { success: false };

        const services = (servicesData.success && servicesData.data?.length) ? servicesData.data : fallbackServices;
        const countries = (countriesData.success && countriesData.data?.length) ? countriesData.data : fallbackCountries;

        return res.status(200).json({
            success: true,
            services,
            countries
        });

    } catch (err) {
        console.error('Server 4 Fetch Error:', err);
        // Return hardcoded data on network failure so the UI never shows 0 items
        return res.status(200).json({
            success: true,
            services: fallbackServices,
            countries: fallbackCountries
        });
    }
}