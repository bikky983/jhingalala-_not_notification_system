/**
 * Weekly Heatmap Notifications Module
 */
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const stateManager = require('../utils/stateManager');
const stockFilter = require('../utils/stockFilter');

class WeeklyHeatmap {
    constructor() {
        this.topNbyVolume = config.criteria.heatmap.topNbyVolume;
        this.minVolume = config.criteria.heatmap.minVolume;
    }

    /**
     * Fetch heatmap data from local JSON file
     * @returns {Promise<Object>} - Heatmap data by sector and stock
     */
    async fetchHeatmapData() {
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
            
            // Define sectors (in real world, this would come from a more complete data source)
            const sectorMapping = {
                'BANK': 'Banking',
                'FINANCE': 'Finance',
                'HYDRO': 'Hydropower',
                'LIFE': 'Insurance',
                'MICRO': 'Microfinance',
                'HOTEL': 'Tourism',
                'DEV': 'Development Bank'
                // Add more mappings as needed
            };
            
            // Assign sectors based on symbol patterns
            const stocksBySector = {};
            
            for (const symbol in symbolData) {
                // Sort data by time in ascending order
                const data = symbolData[symbol].sort((a, b) => 
                    new Date(a.time.replace(/_/g, '-')) - new Date(b.time.replace(/_/g, '-'))
                );
                
                // Need at least 5 days of data
                if (data.length < 5) continue;
                
                // Get the most recent 5 days of data
                const recentData = data.slice(-5);
                
                // Calculate average volume
                let totalVolume = 0;
                let totalChange = 0;
                
                recentData.forEach(day => {
                    if (day.volume) {
                        totalVolume += day.volume;
                    }
                });
                
                // Calculate percent change over the 5-day period
                const startPrice = recentData[0].close;
                const endPrice = recentData[recentData.length - 1].close;
                const percentChange = ((endPrice - startPrice) / startPrice) * 100;
                
                // Determine sector from symbol
                let sector = 'Other';
                for (const key in sectorMapping) {
                    if (symbol.includes(key)) {
                        sector = sectorMapping[key];
                        break;
                    }
                }
                
                // Only add if volume meets minimum requirement
                const avgVolume = totalVolume / recentData.length;
                if (avgVolume >= this.minVolume) {
                    if (!stocksBySector[sector]) {
                        stocksBySector[sector] = [];
                    }
                    
                    stocksBySector[sector].push({
                        symbol: symbol,
                        name: symbol,  // Using symbol as name
                        close: recentData[recentData.length - 1].close,
                        percentChange: percentChange,
                        volume: avgVolume,
                        sector: sector
                    });
                }
            }
            
            // Sort each sector's stocks by volume and take top N
            const sectorsData = {};
            for (const sector in stocksBySector) {
                // Sort by volume in descending order
                const sortedStocks = stocksBySector[sector].sort((a, b) => b.volume - a.volume);
                
                // Take top N by volume
                sectorsData[sector] = sortedStocks.slice(0, this.topNbyVolume);
            }
            
            // Only return real data if we have at least one sector with stocks
            if (Object.keys(sectorsData).length > 0) {
                return sectorsData;
            } else {
                throw new Error('No heatmap data found in processed data');
            }
        } catch (error) {
            console.error('Error processing heatmap data:', error);
            throw error;
        }
    }

    /**
     * Generate sample heatmap data for testing
     * @returns {Object} - Sample heatmap data by sector
     */
    getSampleData() {
        return {
            'Banking': [
                { symbol: 'BANK1', name: 'Bank 1', close: 341, percentChange: 2.2, volume: 245000, sector: 'Banking' },
                { symbol: 'BANK2', name: 'Bank 2', close: 280, percentChange: 1.5, volume: 210000, sector: 'Banking' },
                { symbol: 'BANK3', name: 'Bank 3', close: 195, percentChange: -0.8, volume: 185000, sector: 'Banking' }
            ],
            'Hydropower': [
                { symbol: 'HYDRO1', name: 'Hydro 1', close: 127, percentChange: 3.5, volume: 325000, sector: 'Hydropower' },
                { symbol: 'HYDRO2', name: 'Hydro 2', close: 98, percentChange: 2.1, volume: 290000, sector: 'Hydropower' },
                { symbol: 'HYDRO3', name: 'Hydro 3', close: 115, percentChange: 1.8, volume: 245000, sector: 'Hydropower' }
            ],
            'Insurance': [
                { symbol: 'INSUR1', name: 'Insurance 1', close: 560, percentChange: 1.2, volume: 95000, sector: 'Insurance' },
                { symbol: 'INSUR2', name: 'Insurance 2', close: 715, percentChange: -0.5, volume: 85000, sector: 'Insurance' },
                { symbol: 'INSUR3', name: 'Insurance 3', close: 625, percentChange: 0.7, volume: 75000, sector: 'Insurance' }
            ],
            'Microfinance': [
                { symbol: 'MICRO1', name: 'Micro 1', close: 428, percentChange: 2.8, volume: 125000, sector: 'Microfinance' },
                { symbol: 'MICRO2', name: 'Micro 2', close: 519, percentChange: 1.9, volume: 118000, sector: 'Microfinance' },
                { symbol: 'MICRO3', name: 'Micro 3', close: 390, percentChange: 0.9, volume: 105000, sector: 'Microfinance' }
            ]
        };
    }

    /**
     * Process all heatmap data and prepare for notification
     * @returns {Promise<Object>} - Processed notification data
     */
    async process() {
        try {
            // Fetch the data
            const sectorsData = await this.fetchHeatmapData();
            
            return {
                type: 'weeklyHeatmap',
                data: { sectors: sectorsData },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error processing heatmap data:', error);
            throw error;
        }
    }
}

module.exports = new WeeklyHeatmap(); 