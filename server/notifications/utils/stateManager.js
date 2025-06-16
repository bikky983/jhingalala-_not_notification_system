/**
 * State Manager for tracking previous alerts
 */
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

class StateManager {
    constructor() {
        this.storageFile = config.storage.previousAlerts;
        this.state = {
            lastUpdated: null,
            institutionalStocks: {},
            trendlineStocks: {},
            rsiSupportStocks: {},
            heatmapStocks: {}
        };
    }

    /**
     * Initialize state from file or with defaults
     */
    async initialize() {
        try {
            await this.loadState();
        } catch (error) {
            console.log('No previous state found. Creating new state file.');
            await this.saveState();
        }
    }

    /**
     * Load state from file
     */
    async loadState() {
        try {
            const data = await fs.readFile(this.storageFile, 'utf8');
            this.state = JSON.parse(data);
            return this.state;
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, use default state
                return this.state;
            }
            console.error('Error loading state:', error);
            throw error;
        }
    }

    /**
     * Save current state to file
     */
    async saveState() {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.storageFile);
            await fs.mkdir(dir, { recursive: true });
            
            // Update timestamp
            this.state.lastUpdated = new Date().toISOString();
            
            // Save to file
            await fs.writeFile(
                this.storageFile,
                JSON.stringify(this.state, null, 2),
                'utf8'
            );
        } catch (error) {
            console.error('Error saving state:', error);
            throw error;
        }
    }

    /**
     * Update institutional stocks state
     * @param {Object} stocks - The stocks to store
     */
    async updateInstitutionalStocks(stocks) {
        this.state.institutionalStocks = stocks;
        await this.saveState();
    }

    /**
     * Update trendline stocks state
     * @param {Object} stocks - The stocks to store
     */
    async updateTrendlineStocks(stocks) {
        this.state.trendlineStocks = stocks;
        await this.saveState();
    }

    /**
     * Update RSI support stocks state
     * @param {Object} stocks - The stocks to store
     */
    async updateRSISupportStocks(stocks) {
        this.state.rsiSupportStocks = stocks;
        await this.saveState();
    }

    /**
     * Update heatmap stocks state
     * @param {Object} stocks - The stocks to store
     */
    async updateHeatmapStocks(stocks) {
        this.state.heatmapStocks = stocks;
        await this.saveState();
    }

    /**
     * Check if a stock is new for trendline criteria
     * @param {string} symbol - Stock symbol
     * @returns {boolean} - True if stock is new
     */
    isNewTrendlineStock(symbol) {
        return !this.state.trendlineStocks[symbol];
    }

    /**
     * Get all tracked stocks
     * @returns {Object} - The current state
     */
    getState() {
        return this.state;
    }
}

module.exports = new StateManager(); 