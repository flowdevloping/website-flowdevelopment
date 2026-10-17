// Vercel Serverless Function: GET /api/price?symbol=<ticker>
// Returns the current price in the format the stock tracker expects:
// [{ date, close, name }]

const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const SYMBOL_PATTERN = /^[A-Z0-9.\-=^]{1,15}$/;

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const symbol = String(req.query.symbol || '').trim().toUpperCase();
    if (!SYMBOL_PATTERN.test(symbol)) {
        return res.status(400).json({ error: 'invalid symbol' });
    }

    try {
        const quote = await yahooFinance.quote(symbol);
        if (!quote || quote.regularMarketPrice == null) {
            return res.status(404).json({ error: 'symbol not found' });
        }

        res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
        return res.status(200).json([{
            date: quote.regularMarketTime,
            close: quote.regularMarketPrice,
            name: quote.longName || quote.shortName || symbol,
        }]);
    } catch (error) {
        console.error(`price request failed for ${symbol}`, error);
        return res.status(502).json({ error: 'upstream failed' });
    }
};
