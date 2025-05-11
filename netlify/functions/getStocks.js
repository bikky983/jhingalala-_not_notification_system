const axios = require('axios');
const cheerio = require('cheerio');

// Import the StockScraper class from the module
class StockScraper {
    constructor() {
        this.baseUrl = 'https://merolagani.com/LatestMarket.aspx';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        };
    }

    async scrapeStockData() {
        try {
            const response = await axios.get(this.baseUrl, { headers: this.headers });
            const $ = cheerio.load(response.data);
            const stocks = [];

            // Select the correct table
            $('#ctl00_ContentPlaceHolder1_LiveTrading tr').each((i, element) => {
                if (i === 0) return; // Skip header row

                const tds = $(element).find('td');
                if (tds.length > 0) {
                    try {
                        const stock = {
                            symbol: $(tds[0]).text().trim(),
                            name: $(tds[0]).attr('title') || '',
                            ltp: this.parseNumber($(tds[1]).text()),
                            change: this.parseNumber($(tds[2]).text()),
                            high: this.parseNumber($(tds[4]).text()),
                            low: this.parseNumber($(tds[5]).text()),
                            volume: this.parseNumber($(tds[6]).text()),
                            turnover: this.parseNumber($(tds[7]).text()),
                            timestamp: new Date().toISOString()
                        };

                        // Only add if we have valid symbol and LTP
                        if (stock.symbol && !isNaN(stock.ltp)) {
                            stocks.push(stock);
                        }
                    } catch (err) {
                        console.error(`Error parsing row: ${i}`, err);
                    }
                }
            });

            if (stocks.length === 0) {
                throw new Error('No stocks data found');
            }

            return {
                stocks,
                timestamp: new Date().toISOString(),
                success: true
            };

        } catch (error) {
            console.error('Stock scraping error:', error.message);
            return {
                stocks: [],
                timestamp: new Date().toISOString(),
                success: false,
                error: error.message
            };
        }
    }

    // Helper method to parse numbers from string
    parseNumber(value) {
        if (!value) return 0;
        // Remove commas and convert to number
        const parsed = parseFloat(value.replace(/,/g, ''));
        return isNaN(parsed) ? 0 : parsed;
    }
}

// Create an instance of the scraper
const stockScraper = new StockScraper();

// Netlify function handler
exports.handler = async function(event, context) {
    // Set CORS headers to allow requests from any origin
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };
    
    // Handle OPTIONS request for CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, // No content
            headers,
            body: ''
        };
    }
    
    try {
        const data = await stockScraper.scrapeStockData();
        if (!data.success) {
            throw new Error(data.error);
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data.stocks)
        };
    } catch (error) {
        console.error('Error fetching stocks:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch stock data' })
        };
    }
}; 