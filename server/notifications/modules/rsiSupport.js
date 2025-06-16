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
    }

    /**
     * Fetch RSI support data from the webpage
     * @returns {Promise<Array>} - RSI support data by stock
     */
    async fetchRSISupportData() {
        try {
            // In production, this would be a real API/scraping endpoint
            // For demo purposes, we'll simulate the data structure
            // This should be replaced with actual scraping logic
            
            const response = await axios.get('https://yourwebsite.com/rsi-support', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const $ = cheerio.load(response.data);
            const stocksData = [];
            
            // Scrape data from the table
            $('#rsiSupportTable tr').each((i, element) => {
                if (i === 0) return; // Skip header row
                
                const tds = $(element).find('td');
                if (tds.length > 0) {
                    try {
                        const stock = {
                            symbol: $(tds[0]).text().trim(),
                            name: $(tds[1]).text().trim(),
                            lastPrice: parseFloat($(tds[2]).text().replace(/,/g, '')),
                            rsi: parseFloat($(tds[3]).text()),
                            supportLevel: parseFloat($(tds[4]).text().replace(/,/g, '')),
                            distanceFromSupport: parseFloat($(tds[5]).text()),
                            volume: parseInt($(tds[6]).text().replace(/,/g, '')),
                            percentChange: parseFloat($(tds[7]).text()) / 100
                        };
                        
                        stocksData.push(stock);
                    } catch (err) {
                        console.error(`Error parsing row: ${i}`, err);
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