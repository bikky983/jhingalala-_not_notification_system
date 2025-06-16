const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const stockScraper = require('./server/stockScraper');
require('dotenv').config(); // Add dotenv configuration

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API Routes
app.get('/api/stocks', async (req, res) => {
    try {
        const data = await stockScraper.scrapeStockData();
        if (!data.success) {
            throw new Error(data.error);
        }
        res.json(data.stocks);
    } catch (error) {
        console.error('Error fetching stocks:', error);
        res.status(500).json({ error: 'Failed to fetch stock data' });
    }
});

// Get current prices
app.get('/api/prices', async (req, res) => {
    try {
        const prices = await stockScraper.getStockPrices();
        res.json(prices);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch prices' });
    }
});

// Page Routes
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/dashboard.html');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
