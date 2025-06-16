/**
 * Weekly Heatmap Notifications Module
 */
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config/config');
const stateManager = require('../utils/stateManager');

class WeeklyHeatmap {
    constructor() {
        this.topNbyVolume = config.criteria.heatmap.topNbyVolume;
        this.minVolume = config.criteria.heatmap.minVolume;
        this.browserData = null;
    }

    /**
     * Set browser data if provided from puppeteer
     */
    setBrowserData(data) {
        this.browserData = data;
    }

    /**
     * Fetch heatmap data from the webpage or browser data
     * @returns {Promise<Object>} - Heatmap data by sector
     */
    async fetchHeatmapData() {
        try {
            // If we have browser data, use it
            if (this.browserData && this.browserData.length > 0) {
                console.log('Using browser data for heatmap');
                return this.processBrowserData(this.browserData);
            }
            
            // Fallback to direct API call if browser data is not available
            const response = await axios.get('https://jhingalala.netlify.app/heatmap.html', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const $ = cheerio.load(response.data);
            const sectorsData = {};
            
            // Get sectors from the treemap
            $('table tr').each((i, element) => {
                try {
                    const tds = $(element).find('td');
                    if (tds.length >= 7) {
                        const symbol = $(tds[0]).text().trim();
                        // Extract sector from symbol or use generic sectors
                        // This is an approximation as we don't have actual sector data
                        let sector = 'Unknown';
                        
                        // Simple classification based on common prefixes
                        if (symbol.startsWith('B')) sector = 'Banking';
                        else if (symbol.startsWith('H')) sector = 'Hydropower';
                        else if (symbol.startsWith('M')) sector = 'Microfinance';
                        else if (symbol.startsWith('N')) sector = 'Insurance';
                        else if (symbol.startsWith('P')) sector = 'Production';
                        else sector = 'Other';
                        
                        if (!sectorsData[sector]) {
                            sectorsData[sector] = [];
                        }
                        
                        const stock = {
                            symbol: symbol,
                            name: symbol, // Using symbol as name since name might not be available
                            lastPrice: parseFloat($(tds[1]).text().replace(/,/g, '')) || 0,
                            percentChange: parseFloat($(tds[2]).text()) / 100 || 0,
                            volume: parseInt($(tds[3]).text().replace(/,/g, '')) || 0,
                            supportLevel: parseFloat($(tds[1]).text().replace(/,/g, '')) * 0.95, // Approximating support as 95% of price
                            distanceFromSupport: 5, // Default distance
                            sector: sector
                        };
                        
                        sectorsData[sector].push(stock);
                    }
                } catch (err) {
                    console.error(`Error parsing heatmap row:`, err);
                }
            });
            
            return sectorsData;
        } catch (error) {
            console.error('Error fetching heatmap data:', error);
            // Return sample data for testing
            return this.getSampleData();
        }
    }

    /**
     * Process browser data from puppeteer
     * @param {Array} data - Browser data from puppeteer
     * @returns {Object} - Processed data by sector
     */
    processBrowserData(data) {
        const sectorsData = {};
        
        // Process each row from the browser data
        data.forEach(row => {
            try {
                // Extract symbol from the row
                const symbol = row.symbol || row.col0 || '';
                if (!symbol) return;
                
                // Extract sector from symbol or use generic sectors
                let sector = 'Unknown';
                
                // Simple classification based on common prefixes
                if (symbol.startsWith('B')) sector = 'Banking';
                else if (symbol.startsWith('H')) sector = 'Hydropower';
                else if (symbol.startsWith('M')) sector = 'Microfinance';
                else if (symbol.startsWith('N')) sector = 'Insurance';
                else if (symbol.startsWith('P')) sector = 'Production';
                else sector = 'Other';
                
                if (!sectorsData[sector]) {
                    sectorsData[sector] = [];
                }
                
                // Parse the numeric values
                const lastPrice = parseFloat(row.ltp || row.price || row.col1 || '0') || 0;
                const percentChange = parseFloat(row.change || row.percent_change || row.col2 || '0') / 100 || 0;
                const volume = parseInt(row.volume || row.col3 || '0') || 0;
                
                const stock = {
                    symbol: symbol,
                    name: symbol, // Using symbol as name
                    lastPrice: lastPrice,
                    percentChange: percentChange,
                    volume: volume,
                    supportLevel: lastPrice * 0.95, // Approximating support as 95% of price
                    distanceFromSupport: 5, // Default distance
                    sector: sector
                };
                
                sectorsData[sector].push(stock);
            } catch (err) {
                console.error('Error processing browser data row:', err);
            }
        });
        
        return sectorsData;
    }

    /**
     * Generate sample heatmap data for testing
     * @returns {Object} - Sample heatmap data by sector
     */
    getSampleData() {
        return {
            'Banking': [
                { symbol: 'BANK1', name: 'Bank One', lastPrice: 300, percentChange: 0.02, volume: 250000, supportLevel: 285, distanceFromSupport: 5.3, sector: 'Banking' },
                { symbol: 'BANK2', name: 'Bank Two', lastPrice: 420, percentChange: 0.015, volume: 180000, supportLevel: 408, distanceFromSupport: 2.9, sector: 'Banking' },
                { symbol: 'BANK3', name: 'Bank Three', lastPrice: 250, percentChange: 0.025, volume: 320000, supportLevel: 240, distanceFromSupport: 4.2, sector: 'Banking' },
                { symbol: 'BANK4', name: 'Bank Four', lastPrice: 380, percentChange: -0.01, volume: 150000, supportLevel: 375, distanceFromSupport: 1.3, sector: 'Banking' }
            ],
            'Hydropower': [
                { symbol: 'HYDRO1', name: 'Hydro One', lastPrice: 150, percentChange: 0.035, volume: 450000, supportLevel: 140, distanceFromSupport: 7.1, sector: 'Hydropower' },
                { symbol: 'HYDRO2', name: 'Hydro Two', lastPrice: 200, percentChange: 0.022, volume: 380000, supportLevel: 190, distanceFromSupport: 5.3, sector: 'Hydropower' },
                { symbol: 'HYDRO3', name: 'Hydro Three', lastPrice: 120, percentChange: 0.018, volume: 280000, supportLevel: 110, distanceFromSupport: 9.1, sector: 'Hydropower' },
                { symbol: 'HYDRO4', name: 'Hydro Four', lastPrice: 180, percentChange: -0.008, volume: 190000, supportLevel: 175, distanceFromSupport: 2.9, sector: 'Hydropower' }
            ],
            'Microfinance': [
                { symbol: 'MICRO1', name: 'Micro One', lastPrice: 450, percentChange: 0.028, volume: 180000, supportLevel: 430, distanceFromSupport: 4.7, sector: 'Microfinance' },
                { symbol: 'MICRO2', name: 'Micro Two', lastPrice: 520, percentChange: 0.015, volume: 150000, supportLevel: 500, distanceFromSupport: 4.0, sector: 'Microfinance' },
                { symbol: 'MICRO3', name: 'Micro Three', lastPrice: 380, percentChange: 0.022, volume: 220000, supportLevel: 365, distanceFromSupport: 4.1, sector: 'Microfinance' }
            ],
            'Insurance': [
                { symbol: 'INSUR1', name: 'Insurance One', lastPrice: 550, percentChange: 0.012, volume: 120000, supportLevel: 535, distanceFromSupport: 2.8, sector: 'Insurance' },
                { symbol: 'INSUR2', name: 'Insurance Two', lastPrice: 480, percentChange: 0.018, volume: 190000, supportLevel: 465, distanceFromSupport: 3.2, sector: 'Insurance' }
            ]
        };
    }

    /**
     * Get top N stocks by volume for each sector
     * @param {Object} sectorsData - Heatmap data by sector
     * @returns {Object} - Top N stocks by volume for each sector
     */
    getTopVolumeStocks(sectorsData) {
        const result = {};
        
        // Process each sector
        Object.keys(sectorsData).forEach(sector => {
            const stocks = sectorsData[sector];
            
            // Filter by minimum volume
            const filteredStocks = stocks.filter(stock => stock.volume >= this.minVolume);
            
            // Sort by volume (descending)
            const sortedStocks = filteredStocks.sort((a, b) => b.volume - a.volume);
            
            // Take top N
            result[sector] = sortedStocks.slice(0, this.topNbyVolume);
        });
        
        return result;
    }

    /**
     * Process all heatmap data and prepare for notification
     * @returns {Promise<Object>} - Processed notification data
     */
    async process() {
        try {
            // Fetch the data
            const sectorsData = await this.fetchHeatmapData();
            
            // Get top volume stocks for each sector
            const topVolumeStocks = this.getTopVolumeStocks(sectorsData);
            
            // Calculate total stocks for summary
            let totalStocks = 0;
            Object.values(topVolumeStocks).forEach(stocks => {
                totalStocks += stocks.length;
            });
            
            // Update state
            await stateManager.updateHeatmapStocks(
                Object.values(topVolumeStocks).flat().reduce((acc, stock) => {
                    acc[stock.symbol] = {
                        volume: stock.volume,
                        lastPrice: stock.lastPrice,
                        timestamp: new Date().toISOString()
                    };
                    return acc;
                }, {})
            );
            
            return {
                type: 'weeklyHeatmap',
                data: {
                    sectors: topVolumeStocks,
                    summary: {
                        sectorCount: Object.keys(topVolumeStocks).length,
                        stockCount: totalStocks
                    }
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error processing heatmap data:', error);
            throw error;
        }
    }
}

module.exports = new WeeklyHeatmap(); 