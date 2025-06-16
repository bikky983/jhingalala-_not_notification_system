/**
 * Enhanced Trendline Scanner Notifications Module
 */
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config/config');
const stateManager = require('../utils/stateManager');

class TrendlineScanner {
    constructor() {
        this.minPercentChange = config.criteria.trendline.minPercentChange;
        this.periodToCheck = config.criteria.trendline.periodToCheck;
        this.dataPath = config.storage.dataPath;
        this.browserData = null;
    }

    /**
     * Set browser data if provided from puppeteer
     */
    setBrowserData(data) {
        this.browserData = data;
    }

    /**
     * Fetch trendline data from the webpage or browser data
     * @returns {Promise<Array>} - Trendline data by stock
     */
    async fetchTrendlineData() {
        try {
            // If we have browser data, use it
            if (this.browserData && this.browserData.length > 0) {
                console.log('Using browser data for trendline scanner');
                return this.processBrowserData(this.browserData);
            }
            
            // Fallback to direct API call if browser data is not available
            const response = await axios.get('https://jhingalala.netlify.app/enhanced-trendline-scanner.html', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const $ = cheerio.load(response.data);
            const stocksData = [];
            
            // Find the table that contains trendline data
            $('table tr').each((i, element) => {
                if (i === 0) return; // Skip header row
                
                const tds = $(element).find('td');
                if (tds.length >= 6) {
                    try {
                        // Extract what data is available
                        const symbol = $(tds[1]).text().trim();
                        const currentPrice = parseFloat($(tds[2]).text().replace(/,/g, '')) || 0;
                        
                        // Determine trend direction based on "Distance (%)" or other available indicators
                        let trendDirection = "Uptrend";
                        const distance = parseFloat($(tds[3]).text());
                        if (distance && distance < 0) {
                            trendDirection = "Downtrend";
                        }
                        
                        // Parse other available data or use approximates
                        const percentChange = Math.abs(distance) / 100 || 0.02;
                        const trendStrength = parseFloat($(tds[5]).text()) / 10 || 0.7;
                        
                        const stock = {
                            symbol: symbol,
                            name: symbol, // Using symbol as name
                            trend: trendDirection,
                            percentChange: percentChange,
                            trendStrength: trendStrength,
                            volume: parseInt($(tds[6]).text().replace(/,/g, '')) || 100000,
                            lastPrice: currentPrice,
                            support: currentPrice * (trendDirection === "Uptrend" ? 0.95 : 1.05)
                        };
                        
                        stocksData.push(stock);
                    } catch (err) {
                        console.error(`Error parsing trendline row: ${i}`, err);
                    }
                }
            });
            
            return stocksData;
        } catch (error) {
            console.error('Error fetching trendline data:', error);
            // Return sample data for testing
            return this.getSampleData();
        }
    }

    /**
     * Process browser data from puppeteer
     * @param {Array} data - Browser data from puppeteer
     * @returns {Array} - Processed trendline data
     */
    processBrowserData(data) {
        const stocksData = [];
        
        // Process each row from the browser data
        data.forEach(row => {
            try {
                // Extract symbol and other fields from the row
                const symbol = row.symbol || row.col0 || '';
                if (!symbol) return;
                
                // Parse the numeric values
                const currentPrice = parseFloat(row.price || row.ltp || row.col1 || '0') || 0;
                
                // Determine trend direction based on available indicators
                let trendDirection = "Uptrend";
                const distance = parseFloat(row.distance || row.col2 || '0');
                if (distance && distance < 0) {
                    trendDirection = "Downtrend";
                }
                
                // Parse other available data or use approximates
                const percentChange = parseFloat(row.percent_change || row.change || row.col3 || '2') / 100 || 0.02;
                const trendStrength = parseFloat(row.trend_strength || row.strength || row.col4 || '7') / 10 || 0.7;
                
                const stock = {
                    symbol: symbol,
                    name: symbol, // Using symbol as name
                    trend: trendDirection,
                    percentChange: Math.abs(percentChange), // Use absolute value for percent change
                    trendStrength: trendStrength,
                    volume: parseInt(row.volume || row.col5 || '100000') || 100000,
                    lastPrice: currentPrice,
                    support: currentPrice * (trendDirection === "Uptrend" ? 0.95 : 1.05)
                };
                
                stocksData.push(stock);
            } catch (err) {
                console.error('Error processing browser data row for trendline:', err);
            }
        });
        
        return stocksData;
    }

    /**
     * Generate sample trendline data for testing
     * @returns {Array} - Sample trendline data
     */
    getSampleData() {
        return [
            { symbol: 'BANK', name: 'Bank Ltd', trend: 'Uptrend', percentChange: 0.029, trendStrength: 0.85, volume: 250000, lastPrice: 342, support: 330 },
            { symbol: 'TECH', name: 'Tech Company', trend: 'Uptrend', percentChange: 0.035, trendStrength: 0.92, volume: 180000, lastPrice: 520, support: 490 },
            { symbol: 'FOOD', name: 'Food Corp', trend: 'Downtrend', percentChange: -0.015, trendStrength: 0.65, volume: 120000, lastPrice: 250, support: 240 },
            { symbol: 'HOTEL', name: 'Hotel Chain', trend: 'Sideways', percentChange: 0.005, trendStrength: 0.40, volume: 95000, lastPrice: 180, support: 175 },
            { symbol: 'HYDRO', name: 'Hydro Power', trend: 'Uptrend', percentChange: 0.022, trendStrength: 0.78, volume: 150000, lastPrice: 135, support: 128 },
            { symbol: 'MICRO', name: 'Microfinance', trend: 'Uptrend', percentChange: 0.018, trendStrength: 0.72, volume: 85000, lastPrice: 425, support: 410 }
        ];
    }

    /**
     * Filter stocks to find those in uptrend
     * @param {Array} stocksData - All trendline data
     * @returns {Object} - Object with new and existing uptrend stocks
     */
    async filterUptrendStocks(stocksData) {
        const result = {
            new: [],
            existing: []
        };
        
        // Get current state
        await stateManager.initialize();
        const state = stateManager.getState();
        const previousStocks = state.trendlineStocks || {};
        const now = new Date();
        
        // Filter uptrend stocks with minimum percent change
        stocksData.forEach(stock => {
            if (stock.trend === 'Uptrend' && stock.percentChange >= this.minPercentChange / 100) {
                // Check if it's a new uptrend stock
                const prevStock = previousStocks[stock.symbol];
                
                if (!prevStock) {
                    // New stock in uptrend
                    result.new.push(stock);
                } else {
                    // Calculate days since first detected
                    const firstDetected = new Date(prevStock.firstDetected);
                    const daysSince = Math.floor((now - firstDetected) / (1000 * 60 * 60 * 24));
                    
                    // Add days info to the stock object
                    stock.daysSinceDetected = daysSince;
                    result.existing.push(stock);
                }
            }
        });
        
        // Update state with current uptrend stocks
        const updatedStocks = {};
        [...result.new, ...result.existing].forEach(stock => {
            updatedStocks[stock.symbol] = {
                trend: stock.trend,
                firstDetected: previousStocks[stock.symbol]?.firstDetected || new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };
        });
        
        await stateManager.updateTrendlineStocks(updatedStocks);
        
        return result;
    }

    /**
     * Process all trendline data and prepare for notification
     * @returns {Promise<Object>} - Processed notification data
     */
    async process() {
        try {
            // Fetch the data
            const stocksData = await this.fetchTrendlineData();
            
            // Filter uptrend stocks
            const uptrendStocks = await this.filterUptrendStocks(stocksData);
            
            return {
                type: 'trendlineScanner',
                data: uptrendStocks,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error processing trendline data:', error);
            throw error;
        }
    }
}

module.exports = new TrendlineScanner(); 