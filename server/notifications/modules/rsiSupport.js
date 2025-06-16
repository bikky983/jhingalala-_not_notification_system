/**
 * RSI Support Notifications Module
 */
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const stateManager = require('../utils/stateManager');
const stockFilter = require('../utils/stockFilter');

class RsiSupport {
    constructor() {
        this.maxRSI = config.criteria.rsiSupport.maxRSI;
        this.maxDistanceFromSupport = config.criteria.rsiSupport.maxDistanceFromSupport;
    }

    /**
     * Fetch RSI support data from local JSON file
     * @returns {Promise<Array>} - RSI support data by stock
     */
    async fetchRsiSupportData() {
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
            
            // Process each stock to calculate RSI and detect support levels
            const stocksData = [];
            
            for (const symbol in symbolData) {
                // Sort data by time in ascending order
                const data = symbolData[symbol].sort((a, b) => 
                    new Date(a.time.replace(/_/g, '-')) - new Date(b.time.replace(/_/g, '-'))
                );
                
                // Need at least 15 days of data for RSI calculation
                if (data.length < 15) continue;
                
                // Calculate RSI(14)
                const rsiValues = this.calculateRSI(data, 14);
                
                // Get the most recent close price
                const lastPrice = data[data.length - 1].close;
                
                // Find support levels in the last 120 days (or full data if less)
                const period = Math.min(120, data.length);
                const recentData = data.slice(-period);
                
                // Calculate support levels
                const supportLevels = this.findSupportLevels(recentData);
                
                // Find the nearest support level below current price
                let nearestSupport = 0;
                let percentFromSupport = 100;
                
                for (const support of supportLevels) {
                    if (support < lastPrice) {
                        const distance = ((lastPrice - support) / support) * 100;
                        if (distance < percentFromSupport) {
                            percentFromSupport = distance;
                            nearestSupport = support;
                        }
                    }
                }
                
                // Get current RSI value
                const currentRSI = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 50;
                
                // If RSI is below threshold and price is close to support, add to results
                if (currentRSI <= this.maxRSI && 
                    percentFromSupport <= this.maxDistanceFromSupport && 
                    nearestSupport > 0) {
                    
                    // Determine sector based on stock symbol
                    let sector = 'Other';
                    if (symbol.includes('BANK')) sector = 'Banking';
                    else if (symbol.includes('HYDRO')) sector = 'Hydropower';
                    else if (symbol.includes('LIFE')) sector = 'Insurance';
                    else if (symbol.includes('MICRO')) sector = 'Microfinance';
                    
                    stocksData.push({
                        symbol: symbol,
                        name: symbol, // Using symbol as name
                        currentRSI: currentRSI,
                        supportLevel: nearestSupport,
                        lastPrice: lastPrice,
                        percentFromSupport: percentFromSupport / 100,
                        volume: data[data.length - 1].volume || 0,
                        sector: sector
                    });
                }
            }
            
            // Only return real data if we have at least one item
            if (stocksData.length > 0) {
                return stocksData;
            } else {
                throw new Error('No RSI support stocks found in data');
            }
        } catch (error) {
            console.error('Error processing RSI support data:', error);
            throw error;
        }
    }
    
    /**
     * Calculate RSI (Relative Strength Index)
     * @param {Array} data - Price data array
     * @param {Number} period - RSI period (usually 14)
     * @returns {Array} - Array of RSI values
     */
    calculateRSI(data, period) {
        const rsiValues = [];
        let gains = 0;
        let losses = 0;
        
        // Calculate initial average gain and loss
        for (let i = 1; i <= period; i++) {
            const difference = data[i].close - data[i-1].close;
            if (difference >= 0) {
                gains += difference;
            } else {
                losses += Math.abs(difference);
            }
        }
        
        let avgGain = gains / period;
        let avgLoss = losses / period;
        
        // Calculate smoothed RSI for remaining data
        for (let i = period + 1; i < data.length; i++) {
            const difference = data[i].close - data[i-1].close;
            let currentGain = 0;
            let currentLoss = 0;
            
            if (difference >= 0) {
                currentGain = difference;
            } else {
                currentLoss = Math.abs(difference);
            }
            
            // Calculate smoothed averages
            avgGain = ((avgGain * (period - 1)) + currentGain) / period;
            avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
            
            // Calculate RS and RSI
            const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
            const rsi = 100 - (100 / (1 + rs));
            
            rsiValues.push(rsi);
        }
        
        return rsiValues;
    }
    
    /**
     * Find support levels using swing lows
     * @param {Array} data - Price data array
     * @returns {Array} - Array of support levels
     */
    findSupportLevels(data) {
        const supportLevels = [];
        const windowSize = 5; // Look 5 days before and after
        
        for (let i = windowSize; i < data.length - windowSize; i++) {
            const currentLow = data[i].low;
            let isSupport = true;
            
            // Check if this is a local minimum
            for (let j = i - windowSize; j <= i + windowSize; j++) {
                if (j === i) continue;
                if (data[j].low < currentLow) {
                    isSupport = false;
                    break;
                }
            }
            
            if (isSupport) {
                // Check if similar to existing support level (within 2%)
                let isUnique = true;
                for (const level of supportLevels) {
                    const diff = Math.abs((level - currentLow) / currentLow);
                    if (diff < 0.02) { // 2% tolerance
                        isUnique = false;
                        break;
                    }
                }
                
                if (isUnique) {
                    supportLevels.push(currentLow);
                }
            }
        }
        
        return supportLevels;
    }

    /**
     * Generate sample RSI support data for testing
     * @returns {Array} - Sample RSI support data
     */
    getSampleData() {
        return [
            { symbol: 'BANK', name: 'Bank Ltd', currentRSI: 32.5, supportLevel: 320, lastPrice: 328, percentFromSupport: 0.025, volume: 250000, sector: 'Banking' },
            { symbol: 'HYDRO', name: 'Hydro Power', currentRSI: 35.8, supportLevel: 125, lastPrice: 130, percentFromSupport: 0.04, volume: 320000, sector: 'Hydropower' },
            { symbol: 'MICRO', name: 'Microfinance', currentRSI: 29.2, supportLevel: 390, lastPrice: 400, percentFromSupport: 0.026, volume: 150000, sector: 'Microfinance' },
            { symbol: 'LIFE', name: 'Life Insurance', currentRSI: 38.5, supportLevel: 580, lastPrice: 600, percentFromSupport: 0.035, volume: 95000, sector: 'Insurance' },
            { symbol: 'HOTEL', name: 'Hotel Chain', currentRSI: 33.7, supportLevel: 170, lastPrice: 175, percentFromSupport: 0.029, volume: 120000, sector: 'Tourism' }
        ];
    }

    /**
     * Filter stocks by RSI support criteria
     * @param {Array} stocksData - All RSI support data
     * @returns {Object} - Filtered stocks meeting criteria
     */
    filterBySupport(stocksData) {
        // Filter stocks based on RSI and distance from support
        return stocksData.filter(stock => {
            return stock.currentRSI <= this.maxRSI && 
                   stock.percentFromSupport <= this.maxDistanceFromSupport / 100;
        });
    }

    /**
     * Process all RSI support data and prepare for notification
     * @returns {Promise<Object>} - Processed notification data
     */
    async process() {
        try {
            // Fetch the data
            const stocksData = await this.fetchRsiSupportData();
            
            // Filter stocks by RSI support criteria
            const filteredStocks = this.filterBySupport(stocksData);
            
            // Update state
            await stateManager.updateRSIStocks(
                filteredStocks.reduce((acc, stock) => {
                    acc[stock.symbol] = {
                        rsi: stock.currentRSI,
                        supportLevel: stock.supportLevel,
                        timestamp: new Date().toISOString()
                    };
                    return acc;
                }, {})
            );
            
            return {
                type: 'rsiSupport',
                data: { stocks: filteredStocks },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error processing RSI support data:', error);
            throw error;
        }
    }
}

module.exports = new RsiSupport(); 