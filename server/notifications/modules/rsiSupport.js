/**
 * RSI Support Notifications Module
 */
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config/config');
const stateManager = require('../utils/stateManager');

class RSISupport {
    constructor() {
        this.maxRSI = config.criteria.rsiSupport.maxRSI;
        this.maxDistanceFromSupport = config.criteria.rsiSupport.maxDistanceFromSupport;
        this.browserData = null;
    }

    /**
     * Set browser data if provided from puppeteer
     */
    setBrowserData(data) {
        this.browserData = data;
    }

    /**
     * Fetch RSI support data from the webpage or browser data
     * @returns {Promise<Array>} - RSI support data by stock
     */
    async fetchRSISupportData() {
        try {
            // If we have browser data, use it
            if (this.browserData && this.browserData.length > 0) {
                console.log('Using browser data for RSI support');
                return this.processBrowserData(this.browserData);
            }
            
            // Fallback to direct API call if browser data is not available
            const response = await axios.get('https://jhingalala.netlify.app/rsi-support.html', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const $ = cheerio.load(response.data);
            const stocksData = [];
            
            // Find the table that contains RSI data
            $('table tr').each((i, element) => {
                if (i === 0) return; // Skip header row
                
                const tds = $(element).find('td');
                if (tds.length >= 4) {
                    try {
                        // Extract available data from the table
                        const symbol = $(tds[1]).text().trim();
                        const ltp = parseFloat($(tds[2]).text().replace(/,/g, '')) || 0;
                        const rsi = parseFloat($(tds[3]).text()) || 40; // Default to 40 if not available
                        
                        // Calculate approximates for fields not directly available
                        const supportPrice = parseFloat($(tds[4]).text().replace(/,/g, '')) || ltp * 0.95;
                        const distanceFromSupport = ((ltp - supportPrice) / supportPrice) * 100;
                        
                        const stock = {
                            symbol: symbol,
                            name: symbol, // Using symbol as name since name might not be available
                            lastPrice: ltp,
                            rsi: rsi,
                            supportLevel: supportPrice,
                            distanceFromSupport: parseFloat(distanceFromSupport.toFixed(2)),
                            volume: 100000, // Default volume
                            percentChange: -0.01 // Default percent change
                        };
                        
                        stocksData.push(stock);
                    } catch (err) {
                        console.error(`Error parsing RSI row: ${i}`, err);
                    }
                }
            });
            
            return stocksData;
        } catch (error) {
            console.error('Error fetching RSI support data:', error);
            // Return sample data for testing
            return this.getSampleData();
        }
    }

    /**
     * Process browser data from puppeteer
     * @param {Array} data - Browser data from puppeteer
     * @returns {Array} - Processed RSI support data
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
                const ltp = parseFloat(row.ltp || row.price || row.col1 || '0') || 0;
                const rsi = parseFloat(row.rsi || row.col2 || '40') || 40; // Default to 40 if not available
                
                // Calculate support level and distance
                const supportPrice = parseFloat(row.support_level || row.support || row.col3 || '0') || ltp * 0.95;
                const distanceFromSupport = ((ltp - supportPrice) / supportPrice) * 100;
                
                const stock = {
                    symbol: symbol,
                    name: symbol, // Using symbol as name
                    lastPrice: ltp,
                    rsi: rsi,
                    supportLevel: supportPrice,
                    distanceFromSupport: parseFloat(distanceFromSupport.toFixed(2)),
                    volume: parseInt(row.volume || row.col4 || '100000') || 100000,
                    percentChange: parseFloat(row.percent_change || row.change || row.col5 || '-0.01') / 100 || -0.01
                };
                
                stocksData.push(stock);
            } catch (err) {
                console.error('Error processing browser data row for RSI:', err);
            }
        });
        
        return stocksData;
    }

    /**
     * Generate sample RSI support data for testing
     * @returns {Array} - Sample RSI support data
     */
    getSampleData() {
        return [
            { symbol: 'BANK1', name: 'Bank One', lastPrice: 300, rsi: 35, supportLevel: 290, distanceFromSupport: 3.4, volume: 250000, percentChange: -0.01 },
            { symbol: 'TECH1', name: 'Tech Company', lastPrice: 520, rsi: 28, supportLevel: 505, distanceFromSupport: 3.0, volume: 180000, percentChange: -0.02 },
            { symbol: 'HYDRO1', name: 'Hydro One', lastPrice: 150, rsi: 42, supportLevel: 145, distanceFromSupport: 3.4, volume: 150000, percentChange: -0.015 },
            { symbol: 'MICRO1', name: 'Micro One', lastPrice: 450, rsi: 38, supportLevel: 430, distanceFromSupport: 4.7, volume: 120000, percentChange: -0.008 },
            { symbol: 'HOTEL1', name: 'Hotel One', lastPrice: 180, rsi: 30, supportLevel: 170, distanceFromSupport: 5.9, volume: 95000, percentChange: -0.02 },
            { symbol: 'INSUR1', name: 'Insurance One', lastPrice: 550, rsi: 48, supportLevel: 530, distanceFromSupport: 3.8, volume: 85000, percentChange: -0.005 },
            { symbol: 'FOOD1', name: 'Food One', lastPrice: 250, rsi: 33, supportLevel: 240, distanceFromSupport: 4.2, volume: 110000, percentChange: -0.012 }
        ];
    }

    /**
     * Filter stocks by RSI and support criteria
     * @param {Array} stocksData - All RSI support data
     * @returns {Array} - Filtered stocks meeting RSI support criteria
     */
    filterStocksByRSISupport(stocksData) {
        // Filter by RSI and distance from support
        return stocksData.filter(stock => {
            return stock.rsi <= this.maxRSI && 
                   stock.distanceFromSupport <= this.maxDistanceFromSupport;
        });
    }

    /**
     * Process RSI support data and prepare for notification
     * @returns {Promise<Object>} - Processed notification data
     */
    async process() {
        try {
            // Fetch the data
            const stocksData = await this.fetchRSISupportData();
            
            // Filter stocks by RSI support criteria
            const supportStocks = this.filterStocksByRSISupport(stocksData);
            
            // Sort by RSI (ascending - lower RSI first)
            const sortedStocks = supportStocks.sort((a, b) => a.rsi - b.rsi);
            
            // Update state
            await stateManager.updateRSISupportStocks(
                sortedStocks.reduce((acc, stock) => {
                    acc[stock.symbol] = {
                        rsi: stock.rsi,
                        distanceFromSupport: stock.distanceFromSupport,
                        timestamp: new Date().toISOString()
                    };
                    return acc;
                }, {})
            );
            
            return {
                type: 'rsiSupport',
                data: {
                    stocks: sortedStocks,
                    summary: {
                        count: sortedStocks.length,
                        averageRSI: sortedStocks.reduce((sum, stock) => sum + stock.rsi, 0) / 
                                    (sortedStocks.length || 1)
                    }
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error processing RSI support data:', error);
            throw error;
        }
    }
}

module.exports = new RSISupport(); 