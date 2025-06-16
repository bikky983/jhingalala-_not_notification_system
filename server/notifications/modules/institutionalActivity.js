/**
 * Institutional Activity Notifications Module
 */
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const stateManager = require('../utils/stateManager');
const stockFilter = require('../utils/stockFilter');

class InstitutionalActivity {
    constructor() {
        this.thresholds = config.criteria.institutionalActivity.thresholds;
        this.minPercentChange = config.criteria.institutionalActivity.minPercentChange;
    }

    /**
     * Fetch institutional activity data from local data file
     * @returns {Promise<Array>} - Institutional activity data by stock
     */
    async fetchInstitutionalData() {
        try {
            // Initialize stock filter
            await stockFilter.initialize();
            
            // Path to the organized NEPSE data file
            const dataPath = path.join(process.cwd(), 'public', 'organized_nepse_data.json');
            
            // Read the data file
            const rawData = await fs.readFile(dataPath, 'utf-8');
            const stockData = JSON.parse(rawData);
            
            // Group data by symbol
            const symbolData = {};
            stockData.forEach(entry => {
                // Only include allowed stocks
                if (stockFilter.isAllowedStock(entry.symbol)) {
                    if (!symbolData[entry.symbol]) {
                        symbolData[entry.symbol] = [];
                    }
                    symbolData[entry.symbol].push(entry);
                }
            });
            
            // Process each stock to detect institutional activity
            const stocksData = [];
            
            for (const symbol in symbolData) {
                // Sort data by time in ascending order
                const data = symbolData[symbol].sort((a, b) => 
                    new Date(a.time.replace(/_/g, '-')) - new Date(b.time.replace(/_/g, '-'))
                );
                
                // Need at least 30 days of data
                if (data.length < 30) continue;
                
                // Get the most recent 30 days of data
                const recentData = data.slice(-30);
                
                // Calculate volume anomalies
                const volumes = recentData.map(d => d.volume || 0);
                const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
                const recentVolumes = recentData.slice(-5).map(d => d.volume || 0);
                const avgRecentVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
                
                // Calculate price change
                const startPrice = recentData[0].close;
                const endPrice = recentData[recentData.length - 1].close;
                const percentChange = ((endPrice - startPrice) / startPrice) * 100;
                
                // Calculate volume trend
                const volumeChange = avgRecentVolume / (avgVolume || 1);
                
                // Calculate OBV (On-Balance Volume)
                let obv = 0;
                for (let i = 1; i < recentData.length; i++) {
                    const currentClose = recentData[i].close;
                    const previousClose = recentData[i-1].close;
                    const currentVolume = recentData[i].volume || 0;
                    
                    if (currentClose > previousClose) {
                        obv += currentVolume;
                    } else if (currentClose < previousClose) {
                        obv -= currentVolume;
                    }
                }
                
                // Calculate institutional score based on multiple factors
                let score = 0;
                
                // Factor 1: Volume anomalies (30%)
                if (avgRecentVolume > avgVolume * 1.5) {
                    score += 0.3;
                } else if (avgRecentVolume > avgVolume * 1.2) {
                    score += 0.2;
                } else if (avgRecentVolume > avgVolume) {
                    score += 0.1;
                }
                
                // Factor 2: Price trend alignment (30%)
                if (percentChange > 5 && volumeChange > 1.3) {
                    score += 0.3;
                } else if (percentChange > 2 && volumeChange > 1.1) {
                    score += 0.2;
                } else if (percentChange > 0 && volumeChange > 1) {
                    score += 0.1;
                }
                
                // Factor 3: Price stability and support (20%)
                const prices = recentData.map(d => d.close);
                const maxPrice = Math.max(...prices);
                const minPrice = Math.min(...prices);
                const priceRange = (maxPrice - minPrice) / minPrice;
                
                if (priceRange < 0.05) {
                    score += 0.2; // Very stable price
                } else if (priceRange < 0.1) {
                    score += 0.15; // Moderately stable
                } else if (priceRange < 0.15) {
                    score += 0.1; // Somewhat stable
                }
                
                // Factor 4: OBV trend (20%)
                if (obv > 0 && percentChange > 0) {
                    score += 0.2; // Strong accumulation
                } else if (obv > 0) {
                    score += 0.1; // Some accumulation
                }
                
                // Determine activity type
                let activity = 'Neutral';
                if (score >= 0.7 && percentChange > 0) {
                    activity = 'Increasing';
                } else if (score >= 0.5 && percentChange < 0) {
                    activity = 'Decreasing';
                } else if (score >= 0.5) {
                    activity = 'Stable';
                }
                
                // Get stock name from symbol (or use symbol if name not available)
                const name = symbol;
                
                // Add the stock if it has a significant score
                if (score >= this.thresholds[0] || Math.abs(percentChange) >= this.minPercentChange) {
                    stocksData.push({
                        symbol,
                        name,
                        score,
                        percentChange: percentChange / 100,
                        volume: avgRecentVolume,
                        activity
                    });
                }
            }
            
            // Only return real data if we have at least one item
            if (stocksData.length > 0) {
                return stocksData;
            } else {
                throw new Error('No stocks found with institutional activity signals');
            }
        } catch (error) {
            console.error('Error processing institutional data:', error);
            throw error;
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