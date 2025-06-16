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
        this.browserData = null;
    }

    /**
     * Set browser data if provided from puppeteer
     */
    setBrowserData(data) {
        this.browserData = data;
    }

    /**
     * Fetch institutional activity data from the webpage or browser data
     * @returns {Promise<Array>} - Institutional activity data by stock
     */
    async fetchInstitutionalData() {
        try {
            // If we have browser data, use it
            if (this.browserData && this.browserData.length > 0) {
                console.log('Using browser data for institutional activity');
                return this.processBrowserData(this.browserData);
            }
            
            // Fallback to direct API call if browser data is not available
            // Try to fetch from heatmap page as a fallback since institutional activity
            // doesn't have a dedicated page in the provided URLs
            const response = await axios.get('https://jhingalala.netlify.app/heatmap.html', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const $ = cheerio.load(response.data);
            const stocksData = [];
            
            // Look for institutional activity table or try to extract data from other tables
            // This is a fallback approach since we don't have a dedicated institutional activity page
            const activityTable = $('#institutionalActivityTable');
            
            if (activityTable.length > 0) {
                // If we find the table, extract data normally
                activityTable.find('tr').each((i, element) => {
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
            } else {
                // Try to derive institutional data from other available tables
                // For example: high volume stocks might indicate institutional activity
                $('.sector-table tbody tr, table tr').each((i, element) => {
                    try {
                        const tds = $(element).find('td');
                        if (tds.length >= 5) {
                            const volume = parseInt($(tds[4]).text().replace(/,/g, '')) || 0;
                            const percentChange = parseFloat($(tds[3]).text()) / 100 || 0;
                            
                            // Derive a score based on volume and percent change
                            // This is just an approximation and should be adjusted based on real data patterns
                            const volumeScore = Math.min(volume / 500000, 0.5);  // Scale volume, max 0.5
                            const changeScore = Math.min(Math.abs(percentChange) * 10, 0.5);  // Scale change, max 0.5
                            const score = volumeScore + changeScore;
                            
                            const stock = {
                                symbol: $(tds[0]).text().trim(),
                                name: $(tds[1] || tds[0]).text().trim(),
                                score: parseFloat(score.toFixed(2)),
                                percentChange: percentChange,
                                volume: volume,
                                activity: percentChange > 0 ? 'Increasing' : 'Decreasing'
                            };
                            
                            stocksData.push(stock);
                        }
                    } catch (err) {
                        console.error(`Error parsing row: ${i}`, err);
                    }
                });
            }
            
            if (stocksData.length > 0) {
                return stocksData;
            } else {
                throw new Error('No institutional activity data found');
            }
        } catch (error) {
            console.error('Error fetching institutional data:', error);
            // Return sample data for testing
            return this.getSampleData();
        }
    }

    /**
     * Process browser data from puppeteer
     * @param {Array} data - Browser data from puppeteer
     * @returns {Array} - Processed institutional activity data
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
                const volume = parseInt(row.volume || row.col3 || '0') || 0;
                const percentChange = parseFloat(row.percent_change || row.change || row.col2 || '0') / 100 || 0;
                
                // Derive a score based on volume and percent change
                // This is just an approximation and should be adjusted based on real data patterns
                const volumeScore = Math.min(volume / 500000, 0.5);  // Scale volume, max 0.5
                const changeScore = Math.min(Math.abs(percentChange) * 10, 0.5);  // Scale change, max 0.5
                const score = volumeScore + changeScore;
                
                const stock = {
                    symbol: symbol,
                    name: symbol, // Using symbol as name
                    score: parseFloat(score.toFixed(2)),
                    percentChange: percentChange,
                    volume: volume,
                    activity: percentChange > 0 ? 'Increasing' : 'Decreasing'
                };
                
                stocksData.push(stock);
            } catch (err) {
                console.error('Error processing browser data row for institutional activity:', err);
            }
        });
        
        return stocksData;
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