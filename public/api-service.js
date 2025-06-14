// API Service for the NEPSE Stock Screener
// This file handles all API calls to the serverless functions

class ApiService {
    constructor() {
        // Use direct function paths for reliability in production
        this.baseUrl = '/.netlify/functions';
    }

    // Fetch all available stocks
    async fetchStocks() {
        try {
            const response = await fetch(`${this.baseUrl}/getStocks`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching stocks:', error);
            throw error;
        }
    }

    // Fetch current stock prices
    async fetchPrices() {
        try {
            const response = await fetch(`${this.baseUrl}/getPrices`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching prices:', error);
            throw error;
        }
    }
}

// Create and export a single instance
const apiService = new ApiService();
