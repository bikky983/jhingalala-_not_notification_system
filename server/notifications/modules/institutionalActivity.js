/**
 * Institutional Activity Notifications Module
 */
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config/config');
const stateManager = require('../utils/stateManager');

class InstitutionalActivity {
    constructor() {
        this.thresholds = config.criteria.institutionalActivity.thresholds;
        this.minPercentChange = config.criteria.institutionalActivity.minPercentChange;
    }

    /**
     * Fetch institutional activity data from the webpage
     * @returns {Promise<Array>} - Institutional activity data by stock
     */
    async fetchInstitutionalData() {
        try {
            // In production, this would be a real API/scraping endpoint
            // For demo purposes, we'll simulate the data structure
            // This should be replaced with actual scraping logic
            
            const response = await axios.get('https://yourwebsite.com/institutional-activity', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const $ = cheerio.load(response.data);
            const stocksData = [];
            
            // Scrape data from the table (this is an example structure)
            $('#institutionalActivityTable tr').each((i, element) => {
                if (i === 0) return; // Skip header row
                
                const tds = $(element).find('td');
                if (tds.length > 0) {
                    try {
                        const stock = {
                            symbol: $(tds[0]).text().trim(),
                            name: $(tds[1]).text().trim(),
                            score: parseFloat($(tds[2]).text()),
                            percentChange: parseFloat($(tds[3]).text()) / 100,
                            volume: parseInt($(tds[4]).text().replace(/,/g, '')),
                            activity: $(tds[5]).text().trim()
                        };
                        
                        stocksData.push(stock);
                    } catch (err) {
                        console.error(`Error parsing row: ${i}`, err);
                    }
                }
            });
            
            return stocksData;
        } catch (error) {
            console.error('Error fetching institutional data:', error);
            // Return sample data for testing
            return this.getSampleData();
        }
    }

    /**
     * Generate sample institutional activity data for testing
     * @returns {Array} - Sample institutional activity data
     */
    getSampleData() {
        return [
            { symbol: 'BANK', name: 'Bank Ltd', score: 0.82, percentChange: 0.035, volume: 250000, activity: 'Increasing' },
            { symbol: 'TECH', name: 'Tech Company', score: 0.75, percentChange: 0.028, volume: 180000, activity: 'Stable' },
            { symbol: 'FOOD', name: 'Food Corp', score: 0.67, percentChange: 0.015, volume: 120000, activity: 'Increasing' },
            { symbol: 'HOTEL', name: 'Hotel Chain', score: 0.62, percentChange: 0.012, volume: 95000, activity: 'Decreasing' },
            { symbol: 'HYDRO', name: 'Hydro Power', score: 0.58, percentChange: 0.022, volume: 150000, activity: 'Increasing' },
            { symbol: 'INSUR', name: 'Insurance Inc', score: 0.53, percentChange: 0.009, volume: 85000, activity: 'Stable' },
            { symbol: 'MICRO', name: 'Microfinance', score: 0.48, percentChange: 0.007, volume: 65000, activity: 'Decreasing' },
            { symbol: 'MANU', name: 'Manufacturing', score: 0.42, percentChange: 0.003, volume: 45000, activity: 'Stable' }
        ];
    }

    /**
     * Filter stocks by institutional activity score thresholds
     * @param {Array} stocksData - All institutional activity data
     * @returns {Object} - Categorized stocks by threshold
     */
    filterByThresholds(stocksData) {
        const result = {};
        
        // Initialize result object with threshold categories
        this.thresholds.forEach(threshold => {
            result[threshold] = [];
        });
        
        // Filter stocks into appropriate threshold categories
        stocksData.forEach(stock => {
            // Apply minimum percent change filter
            if (stock.percentChange < this.minPercentChange / 100) {
                return;
            }
            
            // Find the highest threshold that the stock meets
            for (let i = this.thresholds.length - 1; i >= 0; i--) {
                const threshold = this.thresholds[i];
                if (stock.score >= threshold) {
                    result[threshold].push(stock);
                    break;
                }
            }
        });
        
        return result;
    }

    /**
     * Process all institutional activity data and prepare for notification
     * @returns {Promise<Object>} - Processed notification data
     */
    async process() {
        try {
            // Fetch the data
            const stocksData = await this.fetchInstitutionalData();
            
            // Filter by thresholds
            const categorizedStocks = this.filterByThresholds(stocksData);
            
            // Track the processed stocks
            await stateManager.updateInstitutionalStocks(
                stocksData.reduce((acc, stock) => {
                    acc[stock.symbol] = {
                        score: stock.score,
                        timestamp: new Date().toISOString()
                    };
                    return acc;
                }, {})
            );
            
            return {
                type: 'institutionalActivity',
                data: categorizedStocks,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error processing institutional activity data:', error);
            throw error;
        }
    }
}

module.exports = new InstitutionalActivity(); 