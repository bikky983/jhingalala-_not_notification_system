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
                            ltp: this.parseNumber($(tds[1]).text()),
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

    // Get just symbols and prices for watchlist
    async getStockPrices() {
        try {
            const { stocks, success } = await this.scrapeStockData();
            if (!success) throw new Error('Failed to fetch stock data');

            const prices = {};
            stocks.forEach(stock => {
                prices[stock.symbol] = stock.ltp;
            });

            return prices;
        } catch (error) {
            console.error('Error getting stock prices:', error);
            return {};
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
        const prices = await stockScraper.getStockPrices();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(prices)
        };
    } catch (error) {
        console.error('Error fetching prices:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch prices' })
        };
    }
}; 