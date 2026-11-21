// Vercel Serverless Function: GET /api/stock-tracker/search?query=<text>
// Symbol/company search via Yahoo Finance (same source as price and history, so every result is trackable).
// Returns [{ symbol, name }]. No API key needed.

const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const MAX_QUERY_LENGTH = 50;
const MAX_RESULTS = 20;

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const query = String(req.query.query || '').trim();
    if (!query || query.length > MAX_QUERY_LENGTH) {
        return res.status(400).json({ error: `query is required (max ${MAX_QUERY_LENGTH} characters)` });
    }

    try {
        const result = await yahooFinance.search(query, { quotesCount: MAX_RESULTS, newsCount: 0 });
        const results = (result.quotes || [])
            .filter(q => q.symbol && (q.longname || q.shortname))
            .filter(q => q.quoteType !== 'FUTURE' && q.quoteType !== 'OPTION')
            .slice(0, MAX_RESULTS)
            .map(q => ({ symbol: q.symbol, name: q.longname || q.shortname }));

        // Cache identical searches at the edge
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).json(results);
    } catch (error) {
        console.error('Search request failed', error);
        return res.status(502).json({ error: 'Upstream search failed' });
    }
};
