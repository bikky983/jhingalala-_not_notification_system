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
    }

    /**
     * Fetch trendline data from the webpage
     * @returns {Promise<Array>} - Trendline data by stock
     */
    async fetchTrendlineData() {
        try {
            // In production, this would be a real API/scraping endpoint
            // For demo purposes, we'll simulate the data structure
            // This should be replaced with actual scraping logic
            
            const response = await axios.get('https://yourwebsite.com/enhanced-trendline-scanner', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const $ = cheerio.load(response.data);
            const stocksData = [];
            
            // Scrape data from the table
            $('#trendlineTable tr').each((i, element) => {
                if (i === 0) return; // Skip header row
                
                const tds = $(element).find('td');
                if (tds.length > 0) {
                    try {
                        const stock = {
                            symbol: $(tds[0]).text().trim(),
                            name: $(tds[1]).text().trim(),
                            trend: $(tds[2]).text().trim(),
                            percentChange: parseFloat($(tds[3]).text()) / 100,
                            trendStrength: parseFloat($(tds[4]).text()),
                            volume: parseInt($(tds[5]).text().replace(/,/g, '')),
                            lastPrice: parseFloat($(tds[6]).text().replace(/,/g, '')),
                            support: parseFloat($(tds[7]).text().replace(/,/g, ''))
                        };
                        
                        stocksData.push(stock);
                    } catch (err) {
                        console.error(`Error parsing row: ${i}`, err);
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