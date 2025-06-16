/**
 * Enhanced Trendline Scanner Notifications Module
 */
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const stateManager = require('../utils/stateManager');
const stockFilter = require('../utils/stockFilter');

class TrendlineScanner {
    constructor() {
        this.minPercentChange = config.criteria.trendline.minPercentChange;
        this.periodToCheck = config.criteria.trendline.periodToCheck;
        this.dataPath = config.storage.dataPath;
    }

    /**
     * Fetch trendline data from local JSON file
     * @returns {Promise<Array>} - Trendline data by stock
     */
    async fetchTrendlineData() {
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
            
            // Process each stock to detect trendlines
            const stocksData = [];
            
            for (const symbol in symbolData) {
                // Sort data by time in ascending order
                const data = symbolData[symbol].sort((a, b) => 
                    new Date(a.time.replace(/_/g, '-')) - new Date(b.time.replace(/_/g, '-'))
                );
                
                // Need at least 60 days of data for reliable trendline detection
                if (data.length < 60) continue;
                
                // Get the most recent 60 days of data
                const recentData = data.slice(-60);
                
                // Find local minimums for support trendline
                const localMinimums = this.findLocalMinimums(recentData);
                
                // Need at least 2 points to form a trendline
                if (localMinimums.length < 2) continue;
                
                // Calculate support trendline
                const supportTrendline = this.calculateTrendline(localMinimums);
                
                // Calculate current position relative to trendline
                const lastPrice = recentData[recentData.length - 1].close;
                const lastDay = recentData.length - 1;
                const expectedSupport = supportTrendline.slope * lastDay + supportTrendline.intercept;
                
                // Calculate percentage from support
                const percentFromSupport = ((lastPrice - expectedSupport) / expectedSupport) * 100;
                
                // Calculate price change over the defined period
                const periodStart = Math.max(0, recentData.length - this.periodToCheck);
                const startPrice = recentData[periodStart].close;
                const percentChange = ((lastPrice - startPrice) / startPrice) * 100;
                
                // Determine trend direction
                let trend = 'Sideways';
                if (supportTrendline.slope > 0 && percentChange >= this.minPercentChange) {
                    trend = 'Uptrend';
                } else if (supportTrendline.slope < 0 && Math.abs(percentChange) >= this.minPercentChange) {
                    trend = 'Downtrend';
                }
                
                // Calculate trend strength based on R-squared and slope
                // Higher R-squared = more reliable trendline
                const trendStrength = Math.min(1, Math.abs(supportTrendline.rSquared * supportTrendline.slope * 20));
                
                // Add to results if meets criteria
                if (Math.abs(percentChange) >= this.minPercentChange) {
                    stocksData.push({
                        symbol,
                        name: symbol, // Using symbol as name
                        trend,
                        percentChange: percentChange / 100,
                        trendStrength,
                        lastPrice,
                        support: expectedSupport,
                        volume: recentData[recentData.length - 1].volume || 0
                    });
                }
            }
            
            // Only return real data if we have at least one item
            if (stocksData.length > 0) {
                return stocksData;
            } else {
                throw new Error('No trendline stocks found in data');
            }
        } catch (error) {
            console.error('Error processing trendline data:', error);
            throw error;
        }
    }
    
    /**
     * Find local minimum points in price data
     * @param {Array} data - Price data array
     * @returns {Array} - Array of local minimum points
     */
    findLocalMinimums(data) {
        const minimums = [];
        const windowSize = 7; // Look 7 days before and after
        
        for (let i = windowSize; i < data.length - windowSize; i++) {
            const currentPrice = data[i].low;
            let isMinimum = true;
            
            // Check if this is a local minimum
            for (let j = i - windowSize; j <= i + windowSize; j++) {
                if (j === i) continue;
                if (data[j].low < currentPrice) {
                    isMinimum = false;
                    break;
                }
            }
            
            if (isMinimum) {
                minimums.push({
                    day: i,
                    price: currentPrice
                });
            }
        }
        
        return minimums;
    }
    
    /**
     * Calculate trendline using linear regression
     * @param {Array} points - Array of points {day, price}
     * @returns {Object} - Trendline parameters
     */
    calculateTrendline(points) {
        const n = points.length;
        
        // Calculate means
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        
        for (const point of points) {
            sumX += point.day;
            sumY += point.price;
            sumXY += point.day * point.price;
            sumX2 += point.day * point.day;
            sumY2 += point.price * point.price;
        }
        
        const meanX = sumX / n;
        const meanY = sumY / n;
        
        // Calculate slope and intercept
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = meanY - slope * meanX;
        
        // Calculate R-squared (coefficient of determination)
        let SSres = 0, SStot = 0;
        
        for (const point of points) {
            const predicted = slope * point.day + intercept;
            SSres += Math.pow(point.price - predicted, 2);
            SStot += Math.pow(point.price - meanY, 2);
        }
        
        const rSquared = 1 - (SSres / SStot);
        
        return { slope, intercept, rSquared };
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