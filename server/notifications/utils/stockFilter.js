/**
 * Stock Filter Utility
 * Reads the stocks.xlsx file and provides filtering functionality
 */
const fs = require('fs').promises;
const path = require('path');
const xlsx = require('xlsx');

class StockFilter {
    constructor() {
        this.allowedStocks = new Set();
        this.initialized = false;
    }

    /**
     * Initialize the filter by reading stocks.xlsx
     * @returns {Promise<boolean>} - Success status
     */
    async initialize() {
        if (this.initialized) {
            return true;
        }

        try {
            // Path to stocks.xlsx
            const stocksFilePath = path.join(process.cwd(), 'public', 'stocks.xlsx');
            
            // Read the file as binary
            const data = await fs.readFile(stocksFilePath);
            
            // Parse the Excel file
            const workbook = xlsx.read(data, { type: 'buffer' });
            
            // Get the first sheet
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            // Convert to JSON
            const stocks = xlsx.utils.sheet_to_json(sheet);
            
            // Extract stock symbols (assuming there's a 'Symbol' column)
            // Look for Symbol, symbol, SYMBOL, or stock_symbol column
            const symbolColumns = ['Symbol', 'symbol', 'SYMBOL', 'stock_symbol', 'StockSymbol', 'Ticker'];
            
            stocks.forEach(stock => {
                // Find the first column that exists in this row
                for (const col of symbolColumns) {
                    if (stock[col]) {
                        this.allowedStocks.add(stock[col].toString().trim());
                        break;
                    }
                }
            });
            
            console.log(`Loaded ${this.allowedStocks.size} allowed stocks from stocks.xlsx`);
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Error initializing stock filter:', error);
            // If we can't read the filter, allow all stocks by default
            this.initialized = false;
            return false;
        }
    }

    /**
     * Check if a stock is in the allowed list
     * @param {string} symbol - Stock symbol to check
     * @returns {boolean} - Whether the stock is allowed
     */
    isAllowedStock(symbol) {
        // If not initialized, allow all stocks
        if (!this.initialized) {
            return true;
        }
        
        return this.allowedStocks.has(symbol);
    }

    /**
     * Filter an array of stocks to only include allowed ones
     * @param {Array} stocks - Array of stock objects
     * @returns {Array} - Filtered array with only allowed stocks
     */
    filterStocks(stocks) {
        // If not initialized, return all stocks
        if (!this.initialized) {
            return stocks;
        }
        
        return stocks.filter(stock => this.allowedStocks.has(stock.symbol));
    }
}

// Export a singleton instance
module.exports = new StockFilter(); 