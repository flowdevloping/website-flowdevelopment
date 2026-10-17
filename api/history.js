// Vercel Serverless Function: GET /api/history?symbol=<ticker>&range=<1d|5d|1mo|3mo|1y|max>
// Returns chart data in the format the stock tracker expects:
// [{ date, open, high, low, close, volume }]

const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const SYMBOL_PATTERN = /^[A-Z0-9.\-=^]{1,15}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// range -> how far back to look and which candle interval to use
const RANGES = {
    '1d':  { days: 1,    interval: '5m'  },
    '5d':  { days: 5,    interval: '30m' },
    '1mo': { days: 31,   interval: '1d'  },
    '3mo': { days: 93,   interval: '1d'  },
    '1y':  { days: 366,  interval: '1d'  },
    'max': { days: null, interval: '1mo' },
};

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const symbol = String(req.query.symbol || '').trim().toUpperCase();
    const range = RANGES[req.query.range];
    if (!SYMBOL_PATTERN.test(symbol) || !range) {
        return res.status(400).json({ error: 'invalid symbol or range' });
    }

    const period2 = new Date();
    const period1 = range.days ? new Date(period2.getTime() - range.days * DAY_MS) : new Date(0);

    try {
        const result = await yahooFinance.chart(symbol, { period1, period2, interval: range.interval });
        const data = (result.quotes || [])
            .filter(q => q.close != null)
            .map(q => ({
                date: q.date,
                open: q.open,
                high: q.high,
                low: q.low,
                close: q.close,
                volume: q.volume,
            }));

        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return res.status(200).json(data);
    } catch (error) {
        console.error(`history request failed for ${symbol} (${req.query.range})`, error);
        return res.status(502).json({ error: 'upstream failed' });
    }
};
