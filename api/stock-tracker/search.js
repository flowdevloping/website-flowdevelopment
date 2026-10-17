// Vercel Serverless Function: GET /api/stock-tracker/search?query=<text>
// Proxy for the Financial Modeling Prep symbol search.
// The API key stays on the server (Vercel env variable FMP_API_KEY) and is never sent to the browser.

const FMP_URL = 'https://financialmodelingprep.com/stable/search-symbol';
const MAX_QUERY_LENGTH = 50;
const MAX_RESULTS = 20;

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
        console.error('FMP_API_KEY is not set');
        return res.status(500).json({ error: 'Server is not configured' });
    }

    const query = String(req.query.query || '').trim();
    if (!query || query.length > MAX_QUERY_LENGTH) {
        return res.status(400).json({ error: `query is required (max ${MAX_QUERY_LENGTH} characters)` });
    }

    try {
        const url = `${FMP_URL}?query=${encodeURIComponent(query)}&apikey=${encodeURIComponent(apiKey)}`;
        const upstream = await fetch(url);

        if (!upstream.ok) {
            // Do not forward the upstream body, it could contain details about the key/plan
            console.error(`FMP responded with status ${upstream.status}`);
            return res.status(502).json({ error: 'Upstream search failed' });
        }

        const data = await upstream.json();
        if (!Array.isArray(data)) {
            console.error('Unexpected FMP response', data);
            return res.status(502).json({ error: 'Unexpected upstream response' });
        }

        // Only return the fields the frontend needs
        const results = data.slice(0, MAX_RESULTS).map(({ symbol, name }) => ({ symbol, name }));

        // Cache identical searches at the edge to save API quota
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).json(results);
    } catch (error) {
        console.error('Search request failed', error);
        return res.status(502).json({ error: 'Upstream search failed' });
    }
};
