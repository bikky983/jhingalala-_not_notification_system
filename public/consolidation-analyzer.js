// Global variables
let userStocks = [];
let currentPrices = {};
let stockHistoricalData = {};
let consolidationResults = [];
let chartInstances = {};
let autoRefreshInterval = null;

// Add D3 chart styles
document.addEventListener('DOMContentLoaded', function() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .chart-container {
            height: 60px;
            width: 150px;
            position: relative;
        }
        
        .multi-chart-container {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .chart-section {
            width: 100%;
            height: 200px;
            margin-bottom: 10px;
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 5px;
            overflow: hidden;
        }
        
        .chart-popup {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }
        
        .chart-popup-content {
            background-color: white;
            width: 90%;
            max-width: 1000px;
            max-height: 90vh;
            border-radius: 5px;
            overflow: auto;
            display: flex;
            flex-direction: column;
        }
        
        .chart-popup-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 15px;
            border-bottom: 1px solid #eee;
        }
        
        .chart-popup-body {
            padding: 15px;
            overflow: auto;
        }
        
        .chart-popup-close {
            border: none;
            background: none;
            font-size: 24px;
            cursor: pointer;
        }
        
        .score-section {
            margin-top: 20px;
            padding: 15px;
            border-top: 1px solid #eee;
        }
        
        .score-details table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        
        .score-details th, .score-details td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        
        .score-details th {
            background-color: #f5f5f5;
        }
        
        /* Action button styles */
        .action-btn {
            background-color: #f0f0f0;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 4px 8px;
            margin-right: 5px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
        }
        
        .action-btn:hover {
            background-color: #e0e0e0;
        }
        
        /* Watchlist button styles */
        .watchlist-btn {
            font-size: 16px;
            padding: 2px 8px;
            color: #888;
        }
        
        .watchlist-btn.active {
            color: #ffbf00;
            background-color: #fff6e0;
        }
        
        /* Analysis button styles */
        .analysis-btn {
            background-color: #e3f2fd;
            color: #1976d2;
            border-color: #bbdefb;
        }
        
        .analysis-btn:hover {
            background-color: #bbdefb;
        }
        
        /* Watchlist item highlight */
        tr.watchlist-item {
            background-color: #fffde7;
        }
    `;
    document.head.appendChild(styleElement);
});

// Technical indicator settings
const DEFAULT_LOOKBACK_PERIOD = 20;
const DEFAULT_BB_PERIOD = 20;
const DEFAULT_ATR_PERIOD = 14;
const DEFAULT_MIN_SCORE = 3;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize page
    initializePage();
    setupEventListeners();
    
    // Instead of creating a new popup, ensure the existing one works properly
    setupExistingChartPopup();
    
    // Fetch historical data
    fetchHistoricalData();
    
    // Start auto-refresh if enabled
    setupAutoRefresh();
    
    // Load saved filter settings
    loadFilterSettings();
    
    // Initialize watchlist
    if (typeof initWatchlist === 'function') {
        initWatchlist();
    }
});

// Function to set up the existing chart popup in the HTML
function setupExistingChartPopup() {
    // Get the existing popup
    const popup = document.querySelector('.chart-popup');
    if (!popup) return;
    
    // Set proper styles for chart containers
    const chartContainers = [
        { id: 'popupPriceChart', height: '400px' },
        { id: 'popupVolumeChart', height: '150px' },
        { id: 'popupBBWChart', height: '150px' },
        { id: 'popupATRChart', height: '150px' }
    ];
    
    chartContainers.forEach(container => {
        const element = document.getElementById(container.id);
        if (element) {
            element.style.height = container.height;
            element.style.marginBottom = '20px';
        }
    });
    
    // Ensure close button works
    const closeButton = popup.querySelector('.chart-popup-close');
    if (closeButton) {
        // Remove any existing listeners by cloning
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        
        // Add event listener
        newCloseButton.addEventListener('click', () => {
            popup.style.display = 'none';
        });
    }
}

// Setup auto refresh functionality
function setupAutoRefresh() {
    clearInterval(autoRefreshInterval);
    
    const isAutoRefreshEnabled = localStorage.getItem('autoRefreshEnabled') === 'true';
    if (isAutoRefreshEnabled) {
        // Refresh every 60 seconds
        autoRefreshInterval = setInterval(() => {
            loadCurrentPrices();
            analyzeConsolidationPatterns();
        }, 60000);
    }
}

// Toggle auto refresh on/off
function toggleAutoRefresh() {
    const autoRefreshBtn = document.getElementById('autoRefreshBtn');
    const isCurrentlyEnabled = localStorage.getItem('autoRefreshEnabled') === 'true';
    
    // Toggle the state
    const newState = !isCurrentlyEnabled;
    localStorage.setItem('autoRefreshEnabled', newState.toString());
    
    // Update button text
    autoRefreshBtn.textContent = newState ? 'Disable Auto Refresh' : 'Enable Auto Refresh';
    
    // Setup auto-refresh based on new state
    setupAutoRefresh();
    
    showSuccess(`Auto refresh ${newState ? 'enabled' : 'disabled'}`);
}

// Initialize the page
function initializePage() {
    loadUserStocks();
    loadCurrentPrices();
}

// Setup event listeners for buttons and controls
function setupEventListeners() {
    document.getElementById('refreshAnalysisBtn').addEventListener('click', () => {
        loadCurrentPrices();
        analyzeConsolidationPatterns();
    });
    
    // Add to watchlist button
    document.getElementById('addToWatchlistBtn').addEventListener('click', addSelectedToWatchlist);
    
    // Auto-refresh toggle
    const autoRefreshBtn = document.getElementById('autoRefreshBtn');
    const isAutoRefreshEnabled = localStorage.getItem('autoRefreshEnabled') === 'true';
    autoRefreshBtn.textContent = isAutoRefreshEnabled ? 'Disable Auto Refresh' : 'Enable Auto Refresh';
    autoRefreshBtn.addEventListener('click', toggleAutoRefresh);
    
    // Filter inputs
    document.getElementById('lookbackPeriod').addEventListener('change', () => {
        saveFilterSettings();
        analyzeConsolidationPatterns();
    });
    
    document.getElementById('bb-period').addEventListener('change', () => {
        saveFilterSettings();
        analyzeConsolidationPatterns();
    });
    
    document.getElementById('atr-period').addEventListener('change', () => {
        saveFilterSettings();
        analyzeConsolidationPatterns();
    });
    
    document.getElementById('min-score').addEventListener('change', () => {
        saveFilterSettings();
        analyzeConsolidationPatterns();
    });
    
    document.getElementById('showWatchlistOnly').addEventListener('change', () => {
        saveFilterSettings();
        analyzeConsolidationPatterns();
    });
    
    // Handle window resize for responsive charts
    window.addEventListener('resize', () => {
        // Redraw all charts on resize
        Object.keys(chartInstances).forEach(symbol => {
            if (chartInstances[symbol] && chartInstances[symbol].container) {
                // Resize the chart
                initializeStockChart(symbol);
            }
        });
    });
}

// Load user stocks from localStorage
function loadUserStocks() {
    userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
}

// Load current prices
function loadCurrentPrices() {
    showLoading(true);
    try {
        // Load current prices from localStorage (set by dashboard)
        const storedPrices = localStorage.getItem('currentPrices');
        if (storedPrices) {
            currentPrices = JSON.parse(storedPrices);
            analyzeConsolidationPatterns();
        } else {
            // Fallback to API if not available in localStorage
            fetchCurrentPricesFromAPI();
        }
    } catch (error) {
        console.error('Error loading current prices:', error);
        showError('Failed to load current prices');
        showLoading(false);
    }
}

// Fetch current prices from API
async function fetchCurrentPricesFromAPI() {
    try {
        const response = await fetch('/api/prices');
        if (!response.ok) {
            throw new Error('Failed to fetch prices');
        }
        
        const data = await response.json();
        currentPrices = data;
        
        // Save to localStorage for other pages to use
        localStorage.setItem('currentPrices', JSON.stringify(currentPrices));
        
        analyzeConsolidationPatterns();
    } catch (error) {
        console.error('Error fetching prices:', error);
        showError('Failed to fetch current prices');
        showLoading(false);
    }
}

// Load saved filter settings
function loadFilterSettings() {
    try {
        const savedSettings = JSON.parse(localStorage.getItem('consolidationAnalyzerSettings') || '{}');
        
        if (savedSettings.lookbackPeriod) {
            document.getElementById('lookbackPeriod').value = savedSettings.lookbackPeriod;
        }
        
        if (savedSettings.bbPeriod) {
            document.getElementById('bb-period').value = savedSettings.bbPeriod;
        }
        
        if (savedSettings.atrPeriod) {
            document.getElementById('atr-period').value = savedSettings.atrPeriod;
        }
        
        if (savedSettings.minScore) {
            document.getElementById('min-score').value = savedSettings.minScore;
        }
        
        if (savedSettings.showWatchlistOnly !== undefined) {
            document.getElementById('showWatchlistOnly').checked = savedSettings.showWatchlistOnly;
        }
    } catch (error) {
        console.error('Error loading filter settings:', error);
    }
}

// Save filter settings
function saveFilterSettings() {
    try {
        const settings = {
            lookbackPeriod: parseInt(document.getElementById('lookbackPeriod').value) || DEFAULT_LOOKBACK_PERIOD,
            bbPeriod: parseInt(document.getElementById('bb-period').value) || DEFAULT_BB_PERIOD,
            atrPeriod: parseInt(document.getElementById('atr-period').value) || DEFAULT_ATR_PERIOD,
            minScore: parseInt(document.getElementById('min-score').value) || DEFAULT_MIN_SCORE,
            showWatchlistOnly: document.getElementById('showWatchlistOnly').checked
        };
        
        localStorage.setItem('consolidationAnalyzerSettings', JSON.stringify(settings));
    } catch (error) {
        console.error('Error saving filter settings:', error);
    }
}

// Utility functions for UI messages
function showError(message) {
    const messageContainer = document.getElementById('messageContainer');
    messageContainer.innerHTML = `<div class="error-message">${message}</div>`;
    setTimeout(() => { messageContainer.innerHTML = ''; }, 5000);
}

function showSuccess(message) {
    const messageContainer = document.getElementById('messageContainer');
    messageContainer.innerHTML = `<div class="success-message">${message}</div>`;
    setTimeout(() => { messageContainer.innerHTML = ''; }, 5000);
}

function showInfo(message) {
    const messageContainer = document.getElementById('messageContainer');
    messageContainer.innerHTML = `<div class="info-message">${message}</div>`;
    setTimeout(() => { messageContainer.innerHTML = ''; }, 5000);
}

function showLoading(show) {
    document.getElementById('loadingIndicator').style.display = show ? 'flex' : 'none';
}

// Fetch historical data
async function fetchHistoricalData() {
    showLoading(true);
    try {
        console.log("Fetching historical data from organized_nepse_data.json...");
        const response = await fetch('organized_nepse_data.json');
        
        if (!response.ok) {
            console.error(`Failed to fetch historical data: ${response.status} ${response.statusText}`);
            throw new Error(`Failed to fetch historical data: ${response.status} ${response.statusText}`);
        }
        
        console.log("Historical data fetched successfully, parsing JSON...");
        const data = await response.json();
        console.log(`JSON parsed successfully. Data type: ${typeof data}, is array: ${Array.isArray(data)}, length: ${Array.isArray(data) ? data.length : Object.keys(data).length}`);
        
        if (Array.isArray(data) && data.length > 0) {
            console.log("Sample data item:", data[0]);
        }
        
        stockHistoricalData = processHistoricalData(data);
        console.log(`Historical data processed. Found ${Object.keys(stockHistoricalData).length} symbols.`);
        
        if (Object.keys(stockHistoricalData).length > 0) {
            const firstSymbol = Object.keys(stockHistoricalData)[0];
            console.log(`Sample data for ${firstSymbol}:`, stockHistoricalData[firstSymbol].slice(0, 2));
        }
        
        // Once data is loaded, analyze
        analyzeConsolidationPatterns();
    } catch (error) {
        console.error('Error fetching historical data:', error);
        showError('Failed to load historical price data');
        showLoading(false);
    }
}

// Process historical data into usable format
function processHistoricalData(data) {
    const processed = {};
    
    // Check if data is an array (flat structure with symbol in each object)
    if (Array.isArray(data)) {
        // Group by symbol
        data.forEach(item => {
            const symbol = item.symbol;
            if (!symbol) return;
            
            if (!processed[symbol]) {
                processed[symbol] = [];
            }
            
            // Convert time field to date field for consistency
            const dataPoint = {
                ...item,
                date: item.time  // Map time to date for compatibility with the rest of the code
            };
            
            processed[symbol].push(dataPoint);
        });
        
        // Sort each symbol's data by date
        Object.keys(processed).forEach(symbol => {
            processed[symbol].sort((a, b) => {
                return new Date(a.date) - new Date(b.date);
            });
        });
        
        console.log(`Processed ${Object.keys(processed).length} symbols from array data`);
        return processed;
    } 
    // Original code for object-keyed data format
    else if (typeof data === 'object' && !Array.isArray(data)) {
        Object.keys(data).forEach(symbol => {
            // Skip if not a valid symbol
            if (!symbol || symbol === 'undefined') return;
            
            // Process the stock's data if available
            if (data[symbol] && Array.isArray(data[symbol])) {
                // Sort by date ascending
                const sortedData = [...data[symbol]].sort((a, b) => {
                    return new Date(a.date) - new Date(b.date);
                });
                
                processed[symbol] = sortedData;
            }
        });
        
        console.log(`Processed ${Object.keys(processed).length} symbols from object data`);
        return processed;
    }
    
    console.error('Unknown data format:', typeof data, Array.isArray(data));
    return {};
}

// Main function to analyze consolidation patterns
function analyzeConsolidationPatterns() {
    if (!stockHistoricalData || Object.keys(stockHistoricalData).length === 0) {
        showError('No historical data loaded. Please refresh the page.');
        showLoading(false);
        return;
    }
    
    // Get filter settings
    const lookbackPeriod = parseInt(document.getElementById('lookbackPeriod').value) || DEFAULT_LOOKBACK_PERIOD;
    const bbPeriod = parseInt(document.getElementById('bb-period').value) || DEFAULT_BB_PERIOD;
    const atrPeriod = parseInt(document.getElementById('atr-period').value) || DEFAULT_ATR_PERIOD;
    const rsiPeriod = parseInt(document.getElementById('rsi-period').value) || 14;
    const minScore = parseInt(document.getElementById('min-score').value) || DEFAULT_MIN_SCORE;
    const showWatchlistOnly = document.getElementById('showWatchlistOnly').checked;
    const requireRsiConfirmation = document.getElementById('requireRsiConfirmation').checked;
    const srSensitivity = parseFloat(document.getElementById('sr-sensitivity').value) || 1.5;
    const nearSupportResistance = document.getElementById('nearSupportResistance').checked;
    const srProximity = parseFloat(document.getElementById('sr-proximity').value) || 3;
    
    // Pattern filter settings
    const patternFilterValue = document.getElementById('pattern-filter').value;
    const minPatternConfidence = parseFloat(document.getElementById('min-pattern-confidence').value) || 0.6;
    const filterByBreakoutBias = document.getElementById('filterByBreakoutBias').checked;
    const breakoutBiasValue = document.getElementById('breakout-bias').value;
    
    // Log diagnostic information
    console.log(`Historical data keys: ${Object.keys(stockHistoricalData).length}`);
    console.log(`Current prices keys: ${Object.keys(currentPrices).length}`);
    console.log(`User stocks: ${userStocks.length}`);
    console.log(`Filter settings - LookbackPeriod: ${lookbackPeriod}, BBPeriod: ${bbPeriod}, ATRPeriod: ${atrPeriod}, RSIPeriod: ${rsiPeriod}, MinScore: ${minScore}, WatchlistOnly: ${showWatchlistOnly}`);
    
    consolidationResults = [];
    let patternResults = [];
    let srAnalysisResults = [];
    
    // Process each stock with historical data
    Object.keys(stockHistoricalData).forEach(symbol => {
        // Skip if not in watchlist/dashboard but filter is enabled
        if (showWatchlistOnly && !userStocks.some(stock => stock.symbol === symbol)) {
            console.log(`Skipping ${symbol} - not in dashboard/watchlist`);
            return;
        }
        
        // Skip if no current price
        if (!currentPrices[symbol]) {
            console.log(`Skipping ${symbol} - no current price`);
            return;
        }
        
        const historicalData = stockHistoricalData[symbol];
        if (!historicalData || historicalData.length < lookbackPeriod) {
            console.log(`Skipping ${symbol} - insufficient historical data`);
            return;
        }
        
        // Get recent data for analysis
        const recentData = historicalData.slice(-lookbackPeriod);
        const currentPrice = currentPrices[symbol];
        
        // Calculate various technical indicators
        const bbwData = calculateBollingerBandWidth(recentData, bbPeriod);
        const bbwTrend = calculateTrend(bbwData);
        
        const atrData = calculateATR(recentData, atrPeriod);
        const atrTrend = calculateTrend(atrData);
        
        const volumeTrend = calculateVolumeTrend(recentData);
        
        const priceRange = calculatePriceRange(recentData);
        
        const daysInRange = calculateDaysInRange(recentData);
        
        const closenessToPrevHigh = calculateClosenessToPreviousHigh(recentData, currentPrice);
        
        // New indicators
        const rsiAnalysis = checkRSIConsolidation(recentData, rsiPeriod);
        const patternAnalysis = detectConsolidationPattern(recentData);
        const srLevels = detectSupportResistanceLevels(recentData, srSensitivity);
        
        // Get pattern details
        const patternDetails = getPatternDetails(patternAnalysis.pattern);
        
        // Check if stock is near support or resistance
        let nearSR = false;
        let nearestLevel = null;
        let nearestType = null;
        let nearestDistance = Infinity;
        
        // Check proximity to support levels
        srLevels.support.forEach(level => {
            const distance = ((currentPrice - level.price) / currentPrice) * 100;
            if (Math.abs(distance) < srProximity && Math.abs(distance) < nearestDistance) {
                nearSR = true;
                nearestLevel = level.price;
                nearestType = 'support';
                nearestDistance = Math.abs(distance);
            }
        });
        
        // Check proximity to resistance levels
        srLevels.resistance.forEach(level => {
            const distance = ((level.price - currentPrice) / currentPrice) * 100;
            if (Math.abs(distance) < srProximity && Math.abs(distance) < nearestDistance) {
                nearSR = true;
                nearestLevel = level.price;
                nearestType = 'resistance';
                nearestDistance = Math.abs(distance);
            }
        });
        
        // Skip if RSI confirmation is required but not met
        if (requireRsiConfirmation && !rsiAnalysis.isConsolidating) {
            console.log(`Skipping ${symbol} - RSI not consolidating`);
            return;
        }
        
        // Pattern filtering
        if (patternFilterValue !== 'all' && patternAnalysis.pattern !== patternFilterValue) {
            console.log(`Skipping ${symbol} - pattern doesn't match filter`);
            return;
        }
        
        if (patternAnalysis.confidence < minPatternConfidence) {
            console.log(`Skipping ${symbol} - pattern confidence below threshold`);
            return;
        }
        
        if (filterByBreakoutBias && breakoutBiasValue !== 'all' && patternDetails.breakoutBias !== breakoutBiasValue) {
            console.log(`Skipping ${symbol} - breakout bias doesn't match filter`);
            return;
        }
        
        // Calculate enhanced consolidation score (1-10)
        const consolidationScore = calculateConsolidationScore({
            bbwTrend,
            atrTrend,
            volumeTrend,
            priceRange,
            daysInRange,
            closenessToPrevHigh,
            rsiAnalysis,
            patternAnalysis,
            nearSR
        });
        
        console.log(`${symbol} - Score: ${consolidationScore}, Min required: ${minScore}, Pattern: ${patternDetails.name}`);
        
        // Apply score filter
        if (consolidationScore >= minScore) {
        consolidationResults.push({
            symbol,
            currentPrice,
            consolidationScore,
            indicators: {
                bbwTrend,
                atrTrend,
                volumeTrend,
                priceRange,
                daysInRange,
                    closenessToPrevHigh,
                    rsiRange: rsiAnalysis.rsiRange,
                    isRsiConsolidating: rsiAnalysis.isConsolidating
            },
            daysInRange,
            volumeTrend,
            bbwData: bbwData,
            atrData: atrData,
                priceData: recentData,
                rsiData: rsiAnalysis.rsiValues,
                patternType: patternAnalysis.pattern,
                patternConfidence: patternAnalysis.confidence,
                patternDetails: patternDetails,
                srLevels: srLevels,
                nearSR: nearSR,
                nearestLevel: nearestLevel,
                nearestType: nearestType,
                nearestDistance: nearestDistance
            });
        }
        
        // Add to pattern results regardless of score
        patternResults.push({
            symbol,
            currentPrice,
            patternType: patternAnalysis.pattern,
            patternConfidence: patternAnalysis.confidence,
            patternDetails: patternDetails,
            metrics: patternAnalysis.metrics,
            priceData: recentData,
            srLevels: srLevels,
            nearSR: nearSR,
            nearestLevel: nearestLevel,
            nearestType: nearestType
        });
        
        // Add to SR analysis results
        srAnalysisResults.push({
            symbol,
            currentPrice,
            srLevels: srLevels,
            priceData: recentData,
            nearSR: nearSR,
            nearestLevel: nearestLevel,
            nearestType: nearestType,
            nearestDistance: nearestDistance
        });
    });
    
    // Sort results
    consolidationResults.sort((a, b) => b.consolidationScore - a.consolidationScore);
    patternResults.sort((a, b) => b.patternConfidence - a.patternConfidence);
    srAnalysisResults.sort((a, b) => (a.nearSR ? 0 : 1) - (b.nearSR ? 0 : 1));
    
    console.log(`Total consolidation results: ${consolidationResults.length}`);
    console.log(`Total pattern results: ${patternResults.length}`);
    console.log(`Total S/R analysis results: ${srAnalysisResults.length}`);
    
    // Store all results globally
    window.patternResults = patternResults;
    window.srAnalysisResults = srAnalysisResults;
    
    // Display results based on active tab
    const activeTab = document.querySelector('.tab.active').getAttribute('data-tab');
    if (activeTab === 'consolidation') {
        displayConsolidationResults();
    } else if (activeTab === 'patterns') {
        displayPatternResults();
    } else if (activeTab === 'sr-analysis') {
        displaySRAnalysisResults();
    }
    
    showLoading(false);
}

// Updated calculation of consolidation score
function calculateConsolidationScore(indicators) {
    let score = 0;
    
    // Basic indicators (as before)
    // Bollinger Band Width trend (narrowing is good)
    if (indicators.bbwTrend < -0.1) score += 2;
    else if (indicators.bbwTrend < 0) score += 1;
    
    // ATR trend (decreasing volatility is good)
    if (indicators.atrTrend < -0.1) score += 2;
    else if (indicators.atrTrend < 0) score += 1;
    
    // Volume trend (decreasing volume is good for consolidation)
    if (indicators.volumeTrend < -0.1) score += 2;
    else if (indicators.volumeTrend < 0) score += 1;
    
    // Price range (tighter is better)
    if (indicators.priceRange < 3) score += 2;
    else if (indicators.priceRange < 5) score += 1;
    
    // Days in range (more days is better)
    if (indicators.daysInRange >= 4) score += 2;
    else if (indicators.daysInRange >= 3) score += 1;
    
    // Closeness to previous high (closer is better for breakout potential)
    if (indicators.closenessToPrevHigh > 0 && indicators.closenessToPrevHigh < 3) score += 2;
    else if (indicators.closenessToPrevHigh > 0 && indicators.closenessToPrevHigh < 5) score += 1;
    
    // New indicators
    
    // RSI consolidation (ranging behavior)
    if (indicators.rsiAnalysis && indicators.rsiAnalysis.isConsolidating) {
        if (indicators.rsiAnalysis.rsiRange < 5) score += 2;
        else if (indicators.rsiAnalysis.rsiRange < 10) score += 1;
        
        // Bonus if RSI is in middle zone (40-60)
        const avgRSI = (indicators.rsiAnalysis.rangeLow + indicators.rsiAnalysis.rangeHigh) / 2;
        if (avgRSI >= 40 && avgRSI <= 60) score += 1;
    }
    
    // Pattern recognition score boost
    if (indicators.patternAnalysis) {
        if (indicators.patternAnalysis.confidence >= 0.7) score += 2;
        else if (indicators.patternAnalysis.confidence >= 0.6) score += 1;
        
        // Extra point for classic patterns
        const classicPatterns = ['rectangle', 'ascending_triangle', 'descending_triangle', 'symmetrical_triangle'];
        if (classicPatterns.includes(indicators.patternAnalysis.pattern)) score += 1;
    }
    
    // Support/Resistance proximity bonus
    if (indicators.nearSR) score += 1;
    
    // Cap at 10
    return Math.min(10, score);
}

// Display consolidation results in the table
function displayConsolidationResults() {
    const tableBody = document.querySelector('#consolidationTable tbody');
    tableBody.innerHTML = '';
    
    if (consolidationResults.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="10" style="text-align: center;">No stocks found matching criteria</td>`;
        tableBody.appendChild(row);
        return;
    }
    
    // Create rows for each stock
    consolidationResults.forEach((stock, index) => {
        const row = document.createElement('tr');
        
        // Determine score class
        let scoreClass = '';
        if (stock.consolidationScore >= 8) {
            scoreClass = 'strong-score';
        } else if (stock.consolidationScore >= 5) {
            scoreClass = 'medium-score';
        } else {
            scoreClass = 'weak-score';
        }
        
        // Format volume trend
        let volumeTrendText = 'Neutral';
        let volumeTrendClass = '';
        if (stock.volumeTrend < -0.1) {
            volumeTrendText = 'Decreasing';
            volumeTrendClass = 'positive-indicator';
        } else if (stock.volumeTrend > 0.1) {
            volumeTrendText = 'Increasing';
            volumeTrendClass = 'negative-indicator';
        }
        
        // Create indicator pills
        const indicatorPills = createIndicatorPills(stock.indicators);
        
        // Check watchlist status
        const isWatchlisted = isInWatchlist(stock.symbol);
        
        // Add watchlist-item class if stock is in watchlist
        if (isWatchlisted) {
            row.classList.add('watchlist-item');
        }
        
        // Get pattern bias class
        let patternBiasClass = 'pattern-neutral';
        if (stock.patternDetails.breakoutBias === 'bullish') {
            patternBiasClass = 'pattern-bullish';
        } else if (stock.patternDetails.breakoutBias === 'bearish') {
            patternBiasClass = 'pattern-bearish';
        }
        
        // Build row HTML
        row.innerHTML = `
            <td><input type="checkbox" class="stock-checkbox" data-symbol="${stock.symbol}"></td>
            <td>${stock.symbol}</td>
            <td>${stock.currentPrice.toFixed(2)}</td>
            <td class="${scoreClass}">${stock.consolidationScore}/10</td>
            <td>
                <span class="pattern-indicator ${patternBiasClass}">
                    ${stock.patternDetails.name} (${(stock.patternConfidence * 100).toFixed(0)}%)
                </span>
            </td>
            <td class="indicators-container">${indicatorPills}</td>
            <td>${stock.daysInRange}/5</td>
            <td class="${volumeTrendClass}">${volumeTrendText}</td>
            <td>
                <button data-watchlist="${stock.symbol}" class="action-btn watchlist-btn ${isWatchlisted ? 'active' : ''}" title="${isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}">${isWatchlisted ? '★' : '☆'}</button>
                <button class="action-btn analysis-btn" data-index="${index}">
                    Analysis
                </button>
            </td>
            <td>
                <div class="chart-container" id="chart-container-${stock.symbol}"></div>
            </td>
        `;
        
        tableBody.appendChild(row);
        
        // Initialize mini chart
        initializeStockChart(stock.symbol);
    });
    
    // Add event listeners to buttons
    document.querySelectorAll('.watchlist-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const symbol = this.getAttribute('data-watchlist');
            toggleWatchlist(symbol);
            
            // Update button appearance
            const isNowWatchlisted = isInWatchlist(symbol);
            if (isNowWatchlisted) {
                this.classList.add('active');
                this.title = 'Remove from Watchlist';
                this.textContent = '★';
                
                // Also update the row highlight
                const row = this.closest('tr');
                if (row) {
                    row.classList.add('watchlist-item');
                }
            } else {
                this.classList.remove('active');
                this.title = 'Add to Watchlist';
                this.textContent = '☆';
                
                // Also update the row highlight
                const row = this.closest('tr');
                if (row) {
                    row.classList.remove('watchlist-item');
                }
            }
        });
    });
    
    document.querySelectorAll('.analysis-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            showFullAnalysis(index);
        });
    });
}

// Create indicator pills HTML with RSI indicator added
function createIndicatorPills(indicators) {
    let pillsHtml = '';
    
    // Bollinger Band Width
    if (indicators.bbwTrend < -0.1) {
        pillsHtml += `<span class="indicator-pill positive-indicator">BBW ↓</span>`;
    } else if (indicators.bbwTrend > 0.1) {
        pillsHtml += `<span class="indicator-pill negative-indicator">BBW ↑</span>`;
    } else {
        pillsHtml += `<span class="indicator-pill neutral-indicator">BBW →</span>`;
    }
    
    // ATR
    if (indicators.atrTrend < -0.1) {
        pillsHtml += `<span class="indicator-pill positive-indicator">ATR ↓</span>`;
    } else if (indicators.atrTrend > 0.1) {
        pillsHtml += `<span class="indicator-pill negative-indicator">ATR ↑</span>`;
    } else {
        pillsHtml += `<span class="indicator-pill neutral-indicator">ATR →</span>`;
    }
    
    // Volume
    if (indicators.volumeTrend < -0.1) {
        pillsHtml += `<span class="indicator-pill positive-indicator">Vol ↓</span>`;
    } else if (indicators.volumeTrend > 0.1) {
        pillsHtml += `<span class="indicator-pill negative-indicator">Vol ↑</span>`;
    } else {
        pillsHtml += `<span class="indicator-pill neutral-indicator">Vol →</span>`;
    }
    
    // Price Range
    if (indicators.priceRange < 3) {
        pillsHtml += `<span class="indicator-pill positive-indicator">Tight</span>`;
    } else if (indicators.priceRange < 5) {
        pillsHtml += `<span class="indicator-pill neutral-indicator">Narrow</span>`;
    }
    
    // RSI Consolidation (new)
    if (indicators.isRsiConsolidating) {
        pillsHtml += `<span class="indicator-pill positive-indicator">RSI Stable</span>`;
    } else if (indicators.rsiRange && indicators.rsiRange > 20) {
        pillsHtml += `<span class="indicator-pill negative-indicator">RSI Volatile</span>`;
    }
    
    return pillsHtml;
}

// Check if a stock is in the user's watchlist
function isInWatchlist(symbol) {
    // Find the stock in the user's stocks
    const stock = userStocks.find(stock => stock.symbol === symbol);
    // Return true if found and watchlist is true
    return stock && stock.watchlist === true;
}

// Function to toggle watchlist status for a stock
function toggleWatchlist(symbol) {
    // Get a fresh copy of userStocks from localStorage
    const stocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    
    // Find the stock in the user's stocks
    const stockIndex = stocks.findIndex(stock => stock.symbol === symbol);
    
    if (stockIndex !== -1) {
        // Stock exists, toggle watchlist property
        stocks[stockIndex].watchlist = !stocks[stockIndex].watchlist;
        const isWatchlisted = stocks[stockIndex].watchlist;
        
        // Save changes
        localStorage.setItem('userStocks', JSON.stringify(stocks));
        
        // Update our local copy of userStocks
        userStocks = stocks;
        
        // Update UI
        document.querySelectorAll(`.watchlist-btn[data-watchlist="${symbol}"]`).forEach(btn => {
            btn.classList.toggle('active', isWatchlisted);
            btn.title = isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist';
            btn.textContent = isWatchlisted ? '★' : '☆';
            
            // Also update the row highlight
            const row = btn.closest('tr');
            if (row) {
                if (isWatchlisted) {
                    row.classList.add('watchlist-item');
                } else {
                    row.classList.remove('watchlist-item');
                }
            }
        });
        
        showSuccess(isWatchlisted ? 
            `${symbol} added to watchlist` : 
            `${symbol} removed from watchlist`);
    } else {
        // Stock doesn't exist yet, add it with watchlist=true
        const newStock = {
            symbol,
            watchlist: true,
            addedAt: new Date().toISOString(),
            // Add default fields that dashboard expects
            folder: 'default',
            supportPrice1: null,
            supportPrice2: null,
            supportPrice3: null,
            upperLimit: null
        };
        
        stocks.push(newStock);
        
        // Save updated watchlist
        localStorage.setItem('userStocks', JSON.stringify(stocks));
        
        // Update our local copy of userStocks
        userStocks = stocks;
        
        // Update UI
        document.querySelectorAll(`.watchlist-btn[data-watchlist="${symbol}"]`).forEach(btn => {
            btn.classList.add('active');
            btn.title = 'Remove from Watchlist';
            btn.textContent = '★';
            
            // Also update the row highlight
            const row = btn.closest('tr');
            if (row) {
                row.classList.add('watchlist-item');
            }
        });
        
        showSuccess(`${symbol} added to watchlist`);
    }
}

// Function to add selected stocks to watchlist
function addSelectedToWatchlist() {
    const selectedCheckboxes = document.querySelectorAll('.stock-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
        showInfo('No stocks selected');
        return;
    }
    
    selectedCheckboxes.forEach(checkbox => {
        const symbol = checkbox.getAttribute('data-symbol');
        if (!isInWatchlist(symbol)) {
            toggleWatchlist(symbol);
        }
        checkbox.checked = false;
    });
    
    showSuccess(`${selectedCheckboxes.length} stocks added to watchlist`);
}

// Downsample data for better performance
function downsampleData(data, threshold = 500) {
    if (data.length <= threshold) return data;
    
    const factor = Math.ceil(data.length / threshold);
    return data.filter((_, i) => i % factor === 0);
}

// Initialize mini chart for a stock
function initializeStockChart(symbol) {
    const chartContainer = document.getElementById(`chart-container-${symbol}`);
    if (!chartContainer) return;
    
    // Clear any existing content
    chartContainer.innerHTML = '';
    
    // Get the stock data
    const stock = consolidationResults.find(s => s.symbol === symbol);
    if (!stock || !stock.priceData || stock.priceData.length === 0) {
        const noDataLabel = document.createElement('div');
        noDataLabel.textContent = 'No data available';
        noDataLabel.style.position = 'absolute';
        noDataLabel.style.top = '50%';
        noDataLabel.style.left = '50%';
        noDataLabel.style.transform = 'translate(-50%, -50%)';
        noDataLabel.style.color = '#999';
        chartContainer.appendChild(noDataLabel);
        return;
    }
    
    // Process data
    const data = stock.priceData;
    
    // Downsample if needed
    const displayData = downsampleData(data, 25); // Reduced for better candlestick visibility
    
    // Set up dimensions
    const width = chartContainer.clientWidth || 150;
    const height = 60;
    const margin = {top: 5, right: 5, bottom: 5, left: 5};
    
    // Create SVG
    const svg = d3.select(chartContainer)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .style("overflow", "visible");
    
    // X scale - use index for simplicity
    const x = d3.scaleLinear()
        .domain([0, displayData.length - 1])
        .range([margin.left, width - margin.right]);
    
    // Y scale
    const y = d3.scaleLinear()
        .domain([
            d3.min(displayData, d => d.low) * 0.99,
            d3.max(displayData, d => d.high) * 1.01
        ])
        .range([height - margin.bottom, margin.top]);
    
    // Draw candlesticks
    // Calculate the optimal candlestick width based on chart width and data points
    // Ensure it's at least 1 pixel to avoid negative values
    const candleWidth = Math.max(1, Math.min(8, (width - margin.left - margin.right) / data.length * 0.8));
    
    // Draw candlesticks - bodies
    svg.selectAll("rect.candle")
        .data(displayData)
        .join("rect")
        .attr("class", "candle")
        .attr("x", (d, i) => x(i) - (candleWidth / 2))
        .attr("y", d => y(Math.max(d.open, d.close)))
        .attr("width", candleWidth)
        .attr("height", d => Math.max(1, Math.abs(y(d.open) - y(d.close))))
        .attr("fill", d => d.close > d.open ? "#26a69a" : "#ef5350")
        .attr("stroke", "none");
    
    // Draw wicks (high-low lines)
    svg.selectAll("line.wick")
        .data(displayData)
        .join("line")
        .attr("class", "wick")
        .attr("x1", (d, i) => x(i))
        .attr("x2", (d, i) => x(i))
        .attr("y1", d => y(d.high))
        .attr("y2", d => y(d.low))
        .attr("stroke", d => d.close > d.open ? "#26a69a" : "#ef5350")
        .attr("stroke-width", 0.5);
    
    // Add invisible rect for mouse tracking
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("click", () => {
            showFullAnalysis(consolidationResults.findIndex(s => s.symbol === symbol));
        });
    
    // Store chart instance reference
    chartInstances[symbol] = {
        chart: svg.node(),
        container: chartContainer
    };
}

// Function to show full analysis in popup
function showFullAnalysis(index) {
    const stock = consolidationResults[index];
    if (!stock) return;
    
    // Set popup title
    document.getElementById('popupChartTitle').textContent = `${stock.symbol} - Advanced Analysis`;
    
    // Clear previous charts
    document.getElementById('popupPriceChart').innerHTML = '';
    document.getElementById('popupVolumeChart').innerHTML = '';
    document.getElementById('popupBBWChart').innerHTML = '';
    document.getElementById('popupATRChart').innerHTML = '';
    
    // Make sure chart containers have proper height
    const popupPriceChart = document.getElementById('popupPriceChart');
    if (popupPriceChart) {
        popupPriceChart.style.height = '400px';
        popupPriceChart.style.marginBottom = '20px';
    }
    
    const popupVolumeChart = document.getElementById('popupVolumeChart');
    if (popupVolumeChart) {
        popupVolumeChart.style.height = '150px';
        popupVolumeChart.style.marginBottom = '20px';
    }
    
    const popupBBWChart = document.getElementById('popupBBWChart');
    if (popupBBWChart) {
        popupBBWChart.style.height = '150px';
        popupBBWChart.style.marginBottom = '20px';
    }
    
    const popupATRChart = document.getElementById('popupATRChart');
    if (popupATRChart) {
        popupATRChart.style.height = '150px';
        popupATRChart.style.marginBottom = '20px';
    }
    
    // Add symbol and srLevels to price data for chart display
    const priceDataWithDetails = [...stock.priceData];
    if (priceDataWithDetails.length > 0) {
        priceDataWithDetails[0] = { 
            ...priceDataWithDetails[0], 
            symbol: stock.symbol,
            srLevels: stock.srLevels || { support: [], resistance: [] }
        };
    }
    
    // Create charts
    createPriceChart(priceDataWithDetails, 'popupPriceChart');
    createVolumeChart(stock.priceData, 'popupVolumeChart');
    
    if (stock.bbwData) {
        createIndicatorChart(stock.priceData, stock.bbwData, 'popupBBWChart', 'Bollinger Band Width', '#2196F3');
    }
    
    if (stock.atrData) {
        createIndicatorChart(stock.priceData, stock.atrData, 'popupATRChart', 'Average True Range (ATR)', '#FF9800');
    }
    
    // Create analysis details
    const detailsElement = document.getElementById('consolidationDetails');
    
    // Check if indicators exist
    const indicators = stock.indicators || {};
    
    let bbwTrendText = 'Neutral';
    if (indicators.bbwTrend !== undefined) {
        if (indicators.bbwTrend < -0.1) {
            bbwTrendText = 'Narrowing (Bullish)';
        } else if (indicators.bbwTrend > 0.1) {
            bbwTrendText = 'Widening (Bearish)';
        }
    }
    
    let atrTrendText = 'Neutral';
    if (indicators.atrTrend !== undefined) {
        if (indicators.atrTrend < -0.1) {
            atrTrendText = 'Decreasing (Bullish)';
        } else if (indicators.atrTrend > 0.1) {
            atrTrendText = 'Increasing (Bearish)';
        }
    }
    
    let volumeTrendText = 'Neutral';
    if (stock.volumeTrend !== undefined) {
        if (stock.volumeTrend < -0.1) {
            volumeTrendText = 'Decreasing (Bullish for consolidation)';
        } else if (stock.volumeTrend > 0.1) {
            volumeTrendText = 'Increasing (Bearish for consolidation)';
        }
    }
    
    // Build RSI analysis text
    let rsiAnalysisText = 'Not available';
    if (indicators.isRsiConsolidating) {
        rsiAnalysisText = `Consolidating (Range: ${indicators.rsiRange ? indicators.rsiRange.toFixed(1) : 'N/A'})`;
    } else if (indicators.rsiRange) {
        rsiAnalysisText = `Volatile (Range: ${indicators.rsiRange.toFixed(1)})`;
    }
    
    // Format support/resistance info
    let supportLevels = 'None detected';
    let resistanceLevels = 'None detected';
    
    if (stock.srLevels) {
        if (stock.srLevels.support && stock.srLevels.support.length > 0) {
            supportLevels = stock.srLevels.support.map(level => 
                `${level.price.toFixed(2)} (strength: ${level.strength})`
            ).join('<br>');
        }
        
        if (stock.srLevels.resistance && stock.srLevels.resistance.length > 0) {
            resistanceLevels = stock.srLevels.resistance.map(level => 
                `${level.price.toFixed(2)} (strength: ${level.strength})`
            ).join('<br>');
        }
    }
    
    // Render details
    detailsElement.innerHTML = `
        <h3>Consolidation Analysis for ${stock.symbol}</h3>
            <div class="score-details">
                <table>
                    <tr>
                    <th>Current Price</th>
                    <td>${stock.currentPrice.toFixed(2)}</td>
                    </tr>
                    <tr>
                    <th>Consolidation Score</th>
                    <td>${stock.consolidationScore}/10</td>
                    </tr>
                    <tr>
                    <th>Bollinger Bandwidth Trend</th>
                    <td>${bbwTrendText}</td>
                    </tr>
                    <tr>
                    <th>ATR Trend</th>
                    <td>${atrTrendText}</td>
                    </tr>
                    <tr>
                    <th>Volume Trend</th>
                    <td>${volumeTrendText}</td>
                    </tr>
                    <tr>
                    <th>Days in Range</th>
                    <td>${stock.daysInRange || 'N/A'}/5</td>
                    </tr>
                    <tr>
                    <th>RSI Analysis</th>
                    <td>${rsiAnalysisText}</td>
                    </tr>
                </table>
            </div>
        `;
        
    // Create pattern details section
    const patternDetails = document.getElementById('patternDetails');
    patternDetails.style.display = 'block';
    
    // Check if pattern details exist
    if (!stock.patternDetails || !stock.patternType) {
        patternDetails.innerHTML = `
            <h3>Pattern Recognition</h3>
            <div class="score-details">
                <p>No pattern detected for this stock.</p>
            </div>
        `;
    } else {
        // Get pattern bias class
        let patternBiasClass = 'pattern-neutral';
        if (stock.patternDetails.breakoutBias === 'bullish') {
            patternBiasClass = 'pattern-bullish';
        } else if (stock.patternDetails.breakoutBias === 'bearish') {
            patternBiasClass = 'pattern-bearish';
        }
        
        // Check if metrics exist to avoid errors
        const hasMetrics = stock.metrics && 
                          (stock.metrics.highSlope !== undefined || 
                           stock.metrics.lowSlope !== undefined || 
                           stock.metrics.rangePercent !== undefined);
        
        patternDetails.innerHTML = `
            <h3>Pattern Recognition</h3>
            <div class="score-details">
                <table>
                    <tr>
                        <th>Pattern Type</th>
                        <td><span class="pattern-indicator ${patternBiasClass}">${stock.patternDetails.name}</span></td>
                    </tr>
                    <tr>
                        <th>Confidence</th>
                        <td>${((stock.patternConfidence || 0) * 100).toFixed(0)}%</td>
                    </tr>
                    <tr>
                        <th>Breakout Bias</th>
                        <td>${stock.patternDetails.breakoutBias.charAt(0).toUpperCase() + stock.patternDetails.breakoutBias.slice(1)}</td>
                    </tr>
                    <tr>
                        <th>Description</th>
                        <td>${stock.patternDetails.description}</td>
                    </tr>
                    ${hasMetrics ? `
                    <tr>
                        <th>High Trendline Slope</th>
                        <td>${stock.metrics.highSlope !== undefined ? stock.metrics.highSlope.toFixed(2) + '%' : 'N/A'}</td>
                    </tr>
                    <tr>
                        <th>Low Trendline Slope</th>
                        <td>${stock.metrics.lowSlope !== undefined ? stock.metrics.lowSlope.toFixed(2) + '%' : 'N/A'}</td>
                    </tr>
                    <tr>
                        <th>Price Range</th>
                        <td>${stock.metrics.rangePercent !== undefined ? stock.metrics.rangePercent.toFixed(2) + '%' : 'N/A'}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>
        `;
    }
    
    // Create support/resistance details section
    const srDetails = document.getElementById('srDetails');
    srDetails.style.display = 'block';
    
    srDetails.innerHTML = `
        <h3>Support & Resistance Analysis</h3>
        <div class="score-details">
            <table>
                <tr>
                    <th>Support Levels</th>
                    <td>${supportLevels}</td>
                </tr>
                <tr>
                    <th>Resistance Levels</th>
                    <td>${resistanceLevels}</td>
                </tr>
                <tr>
                    <th>Near S/R Level</th>
                    <td>${stock.nearSR ? 
                        `Yes - ${stock.nearestType.charAt(0).toUpperCase() + stock.nearestType.slice(1)} at ${stock.nearestLevel.toFixed(2)}` : 
                        'No'}</td>
                </tr>
                <tr>
                    <th>Distance to Nearest Level</th>
                    <td>${stock.nearSR && stock.nearestDistance !== undefined ? stock.nearestDistance.toFixed(2) + '%' : 'N/A'}</td>
                </tr>
            </table>
        </div>
    `;
    
    // Show popup
    document.querySelector('.chart-popup').style.display = 'flex';
}

// Helper function to create price chart with D3
function createPriceChart(data, containerId) {
    if (!data || data.length === 0) return;
    
    // Get container
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Clear container first
    container.innerHTML = '';
    
    // Get dimensions
    const width = container.clientWidth;
    const height = container.clientHeight || 400;
    const margin = { top: 40, right: 100, bottom: 50, left: 70 };
    
    // Create SVG
    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);
    
    // Add chart background
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "#f8f9fa");
    
    // X scale - use index for simplicity
    const x = d3.scaleLinear()
        .domain([0, data.length - 1])
        .range([margin.left, width - margin.right]);
    
    // Y scale
    const y = d3.scaleLinear()
        .domain([
            d3.min(data, d => d.low) * 0.99,
            d3.max(data, d => d.high) * 1.01
        ])
        .range([height - margin.bottom, margin.top])
        .nice(); // This makes the y-axis values nicer (rounded)
    
    // Add grid lines
    // Horizontal grid lines
    svg.append("g")
        .attr("class", "grid horizontal-grid")
        .selectAll("line")
        .data(y.ticks(10))
        .enter()
        .append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", d => y(d))
        .attr("y2", d => y(d))
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 0.5);
        
    // Vertical grid lines
    svg.append("g")
        .attr("class", "grid vertical-grid")
        .selectAll("line")
        .data(x.ticks(10))
        .enter()
        .append("line")
        .attr("x1", d => x(d))
        .attr("x2", d => x(d))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom)
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 0.5);
    
    // Add X axis
    svg.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x)
            .ticks(10)
            .tickFormat((d) => {
                if (d >= 0 && d < data.length) {
                    const date = new Date(data[Math.floor(d)].date);
                    return date.toLocaleDateString();
                }
                return "";
            })
        )
        .selectAll("text")
        .attr("y", 10)
        .attr("dy", ".35em")
        .attr("transform", "rotate(0)")
        .style("text-anchor", "middle")
        .style("font-size", "11px");
    
    // Add Y axis
    svg.append("g")
        .attr("class", "axis y-axis")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y)
            .ticks(10)
            .tickFormat(d => d.toFixed(0))
        )
        .selectAll("text")
        .style("font-size", "11px");
    
    // Add Y axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", margin.left / 3)
        .attr("x", -((height - margin.top - margin.bottom) / 2 + margin.top))
        .attr("text-anchor", "middle")
        .attr("fill", "#666")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .text("Price");
        
    // Add title
    svg.append("text")
        .attr("x", (width / 2))
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .text(`${data[0]?.symbol || 'Price'} History`);
    
    // Draw candlesticks
    // Calculate the optimal candlestick width based on chart width and data points
    // Ensure it's at least 1 pixel to avoid negative values
    const availableWidth = width - margin.left - margin.right;
    const candleWidth = Math.max(1, Math.min(8, (availableWidth / Math.max(1, data.length)) * 0.8));
    
    // Draw candlesticks - bodies
    svg.selectAll("rect.candle")
        .data(data)
        .join("rect")
        .attr("class", "candle")
        .attr("x", (d, i) => x(i) - (candleWidth / 2))
        .attr("y", d => y(Math.max(d.open, d.close)))
        .attr("width", candleWidth)
        .attr("height", d => Math.max(1, Math.abs(y(d.open) - y(d.close))))
        .attr("fill", d => d.close > d.open ? "#26a69a" : "#ef5350")
        .attr("stroke", d => d.close > d.open ? "#00897b" : "#c62828")
        .attr("stroke-width", 0.5);
    
    // Draw wicks (high-low lines)
    svg.selectAll("line.wick")
        .data(data)
        .join("line")
        .attr("class", "wick")
        .attr("x1", (d, i) => x(i))
        .attr("x2", (d, i) => x(i))
        .attr("y1", d => y(d.high))
        .attr("y2", d => y(d.low))
        .attr("stroke", d => d.close > d.open ? "#00897b" : "#c62828")
        .attr("stroke-width", 1);
    
    // Add support and resistance levels if available
    if (data[0]?.srLevels) {
        // Support levels
        if (data[0].srLevels.support && data[0].srLevels.support.length > 0) {
            data[0].srLevels.support.forEach(level => {
                if (level && level.price !== undefined) {
                    svg.append("line")
                        .attr("class", "support-line")
                        .attr("x1", margin.left)
                        .attr("x2", width - margin.right)
                        .attr("y1", y(level.price))
                        .attr("y2", y(level.price))
                        .attr("stroke", "#4CAF50")
                        .attr("stroke-width", 1.5)
                        .attr("stroke-dasharray", "4,4");
                    
                    // Add support price label
                    svg.append("text")
                        .attr("class", "price-label")
                        .attr("x", width - margin.right + 10)
                        .attr("y", y(level.price) + 4)
                        .attr("fill", "#4CAF50")
                        .attr("font-size", "12px")
                        .attr("font-weight", "bold")
                        .attr("text-anchor", "start")
                        .text(`S: ${level.price.toFixed(2)}`);
                }
            });
        }
        
        // Resistance levels
        if (data[0].srLevels.resistance && data[0].srLevels.resistance.length > 0) {
            data[0].srLevels.resistance.forEach(level => {
                if (level && level.price !== undefined) {
                    svg.append("line")
                        .attr("class", "resistance-line")
                        .attr("x1", margin.left)
                        .attr("x2", width - margin.right)
                        .attr("y1", y(level.price))
                        .attr("y2", y(level.price))
                        .attr("stroke", "#F44336")
                        .attr("stroke-width", 1.5)
                        .attr("stroke-dasharray", "4,4");
                    
                    // Add resistance price label
                    svg.append("text")
                        .attr("class", "price-label")
                        .attr("x", width - margin.right + 10)
                        .attr("y", y(level.price) - 5)
                        .attr("fill", "#F44336")
                        .attr("font-size", "12px")
                        .attr("font-weight", "bold")
                        .attr("text-anchor", "start")
                        .text(`R: ${level.price.toFixed(2)}`);
                }
            });
        }
    }
    
    // Add chart legend
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${margin.left}, ${margin.top - 15})`);
        
    legend.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", "#26a69a");
        
    legend.append("text")
        .attr("x", 20)
        .attr("y", 10)
        .attr("font-size", "11px")
        .text("Bullish Candle");
        
    legend.append("rect")
        .attr("x", 120)
        .attr("y", 0)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", "#ef5350");
        
    legend.append("text")
        .attr("x", 140)
        .attr("y", 10)
        .attr("font-size", "11px")
        .text("Bearish Candle");
}

// Create volume chart with D3
function createVolumeChart(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const width = container.clientWidth || 700;
    const height = container.clientHeight || 250;
    const margin = {top: 20, right: 30, bottom: 30, left: 50};
    
    // Create SVG
    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);
    
    // X scale - use index for simplicity
    const x = d3.scaleLinear()
        .domain([0, data.length - 1])
        .range([margin.left, width - margin.right]);
    
    // Y scale
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.volume)])
        .range([height - margin.bottom, margin.top]);
    
    // Add line
    const line = d3.line()
        .x((d, i) => x(i))
        .y(d => y(d.volume))
        .curve(d3.curveMonotoneX);
    
    // Draw line
    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#2196F3")
        .attr("stroke-width", 1.5)
        .attr("d", line);
    
    // Add x-axis with dates (every nth label to avoid overcrowding)
    const xAxis = svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x)
            .ticks(10)
            .tickFormat(i => {
                if (i >= 0 && i < data.length) {
                    const date = new Date(data[Math.floor(i)].date);
                    return `${date.getMonth()+1}/${date.getDate()}`;
                }
                return "";
            })
        );
    
    // Add y-axis
    const yAxis = svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));
}

// Create indicator chart with D3
function createIndicatorChart(data, indicatorData, containerId, title, color) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const width = container.clientWidth || 700;
    const height = container.clientHeight || 250;
    const margin = {top: 20, right: 30, bottom: 30, left: 50};
    
    // Create SVG
    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);
    
    // X scale - use index for simplicity
    const x = d3.scaleLinear()
        .domain([0, data.length - 1])
        .range([margin.left, width - margin.right]);
    
    // Y scale
    const y = d3.scaleLinear()
        .domain([0, d3.max(indicatorData)])
        .range([height - margin.bottom, margin.top]);
    
    // Add line
    const line = d3.line()
        .x((d, i) => x(i))
        .y(d => y(d))
        .curve(d3.curveMonotoneX);
    
    // Draw line
    svg.append("path")
        .datum(indicatorData)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .attr("d", line);
    
    // Add x-axis with dates (every nth label to avoid overcrowding)
    const xAxis = svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x)
            .ticks(10)
            .tickFormat(i => {
                if (i >= 0 && i < data.length) {
                    const date = new Date(data[Math.floor(i)].date);
                    return `${date.getMonth()+1}/${date.getDate()}`;
                }
                return "";
            })
        );
    
    // Add y-axis
    const yAxis = svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));
    
    // Add title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text(title);
}

// -------------------- New Technical Indicators --------------------

// Calculate RSI (Relative Strength Index)
function calculateRSI(data, period = 14) {
    if (!data || data.length < period + 1) {
        return [];
    }
    
    const prices = data.map(d => d.close);
    let gains = [];
    let losses = [];
    
    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const rsiData = [];
    
    // Calculate initial averages
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
    
    // Calculate RSI values
    for (let i = period; i < prices.length; i++) {
        // Update averages using the smoothing method
        avgGain = ((avgGain * (period - 1)) + gains[i - 1]) / period;
        avgLoss = ((avgLoss * (period - 1)) + losses[i - 1]) / period;
        
        if (avgLoss === 0) {
            rsiData.push(100);
        } else {
            const rs = avgGain / avgLoss;
            const rsi = 100 - (100 / (1 + rs));
            rsiData.push(rsi);
        }
    }
    
    return rsiData;
}

// Check RSI Consolidation (RSI ranging between 40-60 indicates consolidation)
function checkRSIConsolidation(data, period = 14, threshold = 10) {
    const rsiValues = calculateRSI(data, period);
    
    if (rsiValues.length < 5) {
        return {
            isConsolidating: false,
            rangeLow: 0,
            rangeHigh: 0,
            rsiValues: rsiValues
        };
    }
    
    // Get the last 10 RSI values or all if less than 10
    const recentRSI = rsiValues.slice(-Math.min(10, rsiValues.length));
    
    // Calculate min, max and range of RSI
    const minRSI = Math.min(...recentRSI);
    const maxRSI = Math.max(...recentRSI);
    const rsiRange = maxRSI - minRSI;
    
    // Check if RSI is consolidating (ranging within threshold)
    const isConsolidating = rsiRange <= threshold;
    
    return {
        isConsolidating,
        rangeLow: minRSI,
        rangeHigh: maxRSI,
        rsiRange,
        rsiValues: rsiValues
    };
}

// Detect key support and resistance levels using price clusters
function detectSupportResistanceLevels(data, sensitivity = 1.5) {
    if (!data || data.length < 10) {
        return { support: [], resistance: [] };
    }
    
    // Extract highs and lows
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    
    // Calculate price clusters
    const allPrices = [...highs, ...lows];
    const priceMap = {};
    
    // Round prices to 2 decimal places for clustering
    allPrices.forEach(price => {
        const roundedPrice = Math.round(price * 100) / 100;
        // Create bins with a range of ±sensitivity%
        const priceBin = Math.round(roundedPrice / (roundedPrice * sensitivity / 100));
        
        if (!priceMap[priceBin]) {
            priceMap[priceBin] = {
                price: roundedPrice,
                count: 0
            };
        }
        priceMap[priceBin].count++;
    });
    
    // Sort clusters by count (descending)
    const sortedClusters = Object.values(priceMap)
        .sort((a, b) => b.count - a.count)
        .filter(cluster => cluster.count >= 3); // Minimum 3 touches
    
    // Get current price
    const currentPrice = data[data.length - 1].close;
    
    // Classify as support or resistance
    const support = [];
    const resistance = [];
    
    sortedClusters.forEach(cluster => {
        if (cluster.price < currentPrice) {
            support.push({
                price: cluster.price,
                strength: cluster.count
            });
        } else {
            resistance.push({
                price: cluster.price,
                strength: cluster.count
            });
        }
    });
    
    // Limit to top 5 levels each
    return {
        support: support.slice(0, 5),
        resistance: resistance.slice(0, 5)
    };
}

// Detect consolidation pattern type
function detectConsolidationPattern(data) {
    if (!data || data.length < 10) {
        return { pattern: 'unknown', confidence: 0 };
    }
    
    // Extract price data
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    
    // Get recent data (last 20 days or all if fewer)
    const period = Math.min(20, data.length);
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    
    // Calculate linear regression for highs and lows
    const highIndices = Array.from({ length: recentHighs.length }, (_, i) => i);
    const lowIndices = Array.from({ length: recentLows.length }, (_, i) => i);
    
    const highRegression = linearRegression(highIndices.map((x, i) => ({ x, y: recentHighs[i] })));
    const lowRegression = linearRegression(lowIndices.map((x, i) => ({ x, y: recentLows[i] })));
    
    // Calculate price range
    const priceRange = Math.max(...recentHighs) - Math.min(...recentLows);
    const avgPrice = recentHighs.reduce((sum, price) => sum + price, 0) / recentHighs.length;
    const rangePercent = (priceRange / avgPrice) * 100;
    
    // Calculate high slope and low slope in percentage
    const highSlope = (highRegression.slope / avgPrice) * 100;
    const lowSlope = (lowRegression.slope / avgPrice) * 100;
    
    // Pattern detection logic
    let pattern = 'unknown';
    let confidence = 0;
    
    // Rectangle pattern - both highs and lows are nearly horizontal
    if (Math.abs(highSlope) < 0.2 && Math.abs(lowSlope) < 0.2 && rangePercent < 10) {
        pattern = 'rectangle';
        confidence = 0.8;
    }
    // Ascending triangle - horizontal resistance, rising support
    else if (Math.abs(highSlope) < 0.2 && lowSlope > 0.2) {
        pattern = 'ascending_triangle';
        confidence = 0.7;
    }
    // Descending triangle - horizontal support, falling resistance
    else if (Math.abs(lowSlope) < 0.2 && highSlope < -0.2) {
        pattern = 'descending_triangle';
        confidence = 0.7;
    }
    // Symmetrical triangle - converging trendlines
    else if (highSlope < -0.1 && lowSlope > 0.1) {
        pattern = 'symmetrical_triangle';
        confidence = 0.6;
    }
    // Pennant - small symmetrical triangle
    else if (highSlope < -0.2 && lowSlope > 0.2 && rangePercent < 5) {
        pattern = 'pennant';
        confidence = 0.6;
    }
    // Flag - small rectangle after a trend
    else if (Math.abs(highSlope) < 0.3 && Math.abs(lowSlope) < 0.3 && rangePercent < 5) {
        pattern = 'flag';
        confidence = 0.5;
    }
    // Wedge - converging trendlines with similar slope direction
    else if ((highSlope < 0 && lowSlope < 0 && highSlope < lowSlope) || 
             (highSlope > 0 && lowSlope > 0 && highSlope > lowSlope)) {
        pattern = 'wedge';
        confidence = 0.6;
    }
    
    return {
        pattern,
        confidence,
        metrics: {
            highSlope,
            lowSlope,
            rangePercent
        }
    };
}

// Get pattern human-readable name and potential breakout direction
function getPatternDetails(patternType) {
    const patterns = {
        'rectangle': {
            name: 'Rectangle',
            breakoutBias: 'neutral',
            description: 'Price bounded by horizontal support and resistance'
        },
        'ascending_triangle': {
            name: 'Ascending Triangle',
            breakoutBias: 'bullish',
            description: 'Horizontal resistance with rising support'
        },
        'descending_triangle': {
            name: 'Descending Triangle',
            breakoutBias: 'bearish',
            description: 'Horizontal support with falling resistance'
        },
        'symmetrical_triangle': {
            name: 'Symmetrical Triangle',
            breakoutBias: 'neutral',
            description: 'Converging support and resistance'
        },
        'pennant': {
            name: 'Pennant',
            breakoutBias: 'trend_continuation',
            description: 'Small symmetrical triangle after a strong move'
        },
        'flag': {
            name: 'Flag',
            breakoutBias: 'trend_continuation',
            description: 'Rectangle pattern against the prior trend'
        },
        'wedge': {
            name: 'Wedge',
            breakoutBias: 'reversal',
            description: 'Converging trendlines in same direction'
        },
        'unknown': {
            name: 'Unknown Pattern',
            breakoutBias: 'unknown',
            description: 'No clear pattern detected'
        }
    };
    
    return patterns[patternType] || patterns.unknown;
}

// Add tab navigation functionality
document.addEventListener('DOMContentLoaded', function() {
    setupTabNavigation();
    
    // Connect breakout bias filter with toggle
    document.getElementById('filterByBreakoutBias').addEventListener('change', function() {
        document.getElementById('breakout-bias').disabled = !this.checked;
    });
});

function setupTabNavigation() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Hide all tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Show the corresponding tab content
            const tabName = this.getAttribute('data-tab');
            document.getElementById(tabName + 'Tab').classList.add('active');
            
            // If we already have results, display the appropriate view
            if (tabName === 'patterns' && window.patternResults) {
                displayPatternResults();
            } else if (tabName === 'sr-analysis' && window.srAnalysisResults) {
                displaySRAnalysisResults();
            } else if (tabName === 'consolidation' && consolidationResults) {
                displayConsolidationResults();
            }
        });
    });
}

// Function to display pattern recognition results
function displayPatternResults() {
    if (!window.patternResults || window.patternResults.length === 0) {
        // If we have no results yet, try to analyze
        if (stockHistoricalData && Object.keys(stockHistoricalData).length > 0) {
            analyzeConsolidationPatterns();
            return;
        }
        
        const tableBody = document.querySelector('#patternsTable tbody');
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No pattern results available</td></tr>';
        return;
    }
    
    const tableBody = document.querySelector('#patternsTable tbody');
    tableBody.innerHTML = '';
    
    window.patternResults.forEach(result => {
        const row = document.createElement('tr');
        
        // Get bias style
        let biasClass = 'pattern-neutral';
        if (result.patternDetails.breakoutBias === 'bullish') {
            biasClass = 'pattern-bullish';
        } else if (result.patternDetails.breakoutBias === 'bearish') {
            biasClass = 'pattern-bearish';
        }
        
        // Format S/R proximity
        let srProximityText = 'None';
        if (result.nearSR) {
            srProximityText = `${result.nearestType.charAt(0).toUpperCase() + result.nearestType.slice(1)} at ${result.nearestLevel.toFixed(2)}`;
        }
        
        row.innerHTML = `
            <td>${result.symbol}</td>
            <td>${result.patternDetails.name}</td>
            <td>${(result.patternConfidence * 100).toFixed(0)}%</td>
            <td class="${biasClass}">${result.patternDetails.breakoutBias.charAt(0).toUpperCase() + result.patternDetails.breakoutBias.slice(1)}</td>
            <td>${result.currentPrice.toFixed(2)}</td>
            <td>${srProximityText}</td>
            <td>
                <div class="chart-container" id="pattern-chart-${result.symbol}"></div>
            </td>
        `;
        
        tableBody.appendChild(row);
        
        // Initialize pattern chart
        setTimeout(() => initializePatternChart(result.symbol, result), 100);
    });
}

// Function to display support/resistance analysis results
function displaySRAnalysisResults() {
    if (!window.srAnalysisResults || window.srAnalysisResults.length === 0) {
        // If we have no results yet, try to analyze
        if (stockHistoricalData && Object.keys(stockHistoricalData).length > 0) {
            analyzeConsolidationPatterns();
            return;
        }
        
        const tableBody = document.querySelector('#srAnalysisTable tbody');
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No support/resistance results available</td></tr>';
        return;
    }
    
    const tableBody = document.querySelector('#srAnalysisTable tbody');
    tableBody.innerHTML = '';
    
    window.srAnalysisResults.forEach(result => {
        const row = document.createElement('tr');
        
        // Format support levels
        const supportHtml = result.srLevels.support.map(level => 
            `<span class="support-resistance-indicator support-level">${level.price.toFixed(2)} (x${level.strength})</span>`
        ).join(' ');
        
        // Format resistance levels
        const resistanceHtml = result.srLevels.resistance.map(level => 
            `<span class="support-resistance-indicator resistance-level">${level.price.toFixed(2)} (x${level.strength})</span>`
        ).join(' ');
        
        // Highlight if near S/R
        let srZoneHtml = 'None';
        if (result.nearSR) {
            const levelClass = result.nearestType === 'support' ? 'support-level' : 'resistance-level';
            srZoneHtml = `<span class="support-resistance-indicator ${levelClass}">
                ${result.nearestType.charAt(0).toUpperCase() + result.nearestType.slice(1)} at ${result.nearestLevel.toFixed(2)}
            </span>`;
        }
        
        row.innerHTML = `
            <td>${result.symbol}</td>
            <td>${result.currentPrice.toFixed(2)}</td>
            <td>${supportHtml || "None"}</td>
            <td>${resistanceHtml || "None"}</td>
            <td>${srZoneHtml}</td>
            <td>
                <div class="chart-container" id="sr-chart-${result.symbol}"></div>
            </td>
        `;
        
        tableBody.appendChild(row);
        
        // Initialize SR chart
        setTimeout(() => initializeSRChart(result.symbol, result), 100);
    });
}

// Initialize chart specifically for pattern display
function initializePatternChart(symbol, patternData) {
    const container = document.getElementById(`pattern-chart-${symbol}`);
    if (!container) return;
    
    // Clear any existing content
    container.innerHTML = '';
    
    const width = container.clientWidth || 150;
    const height = container.clientHeight || 80;
    
    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');
    
    // Get price data
    const data = patternData.priceData.slice(-20);
    if (data.length < 5) return;
    
    // Define margins
    const margin = { top: 5, right: 5, bottom: 5, left: 5 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Create scales
    const xScale = d3.scaleLinear()
        .domain([0, data.length - 1])
        .range([0, chartWidth]);
    
    const yScale = d3.scaleLinear()
        .domain([
            d3.min(data, d => d.low) * 0.995,
            d3.max(data, d => d.high) * 1.005
        ])
        .range([chartHeight, 0]);
    
    // Create chart group
    const chartGroup = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Calculate the optimal candlestick width based on chart width and data points
    // Ensure it's at least 1 pixel to avoid negative values
    const candleWidth = Math.max(1, Math.min(4, (chartWidth / data.length) * 0.8));
    
    // Draw candlesticks
    chartGroup.selectAll('.candle')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'candle')
        .attr('x', (d, i) => xScale(i) - (candleWidth / 2))
        .attr('y', d => yScale(Math.max(d.open, d.close)))
        .attr('width', candleWidth)
        .attr('height', d => Math.max(1, Math.abs(yScale(d.open) - yScale(d.close))))
        .attr('fill', d => d.close > d.open ? '#4CAF50' : '#F44336');
    
    // Draw wicks
    chartGroup.selectAll('.wick')
        .data(data)
        .enter()
        .append('line')
        .attr('class', 'wick')
        .attr('x1', (d, i) => xScale(i))
        .attr('x2', (d, i) => xScale(i))
        .attr('y1', d => yScale(d.high))
        .attr('y2', d => yScale(d.low))
        .attr('stroke', d => d.close > d.open ? '#4CAF50' : '#F44336');
    
    // Draw pattern trendlines
    if (patternData.metrics) {
        const { highSlope, lowSlope } = patternData.metrics;
        const firstIndex = 0;
        const lastIndex = data.length - 1;
        
        // Only draw trendlines if slopes are defined
        if (highSlope !== undefined) {
            // High trendline
            const highStart = d3.max(data.slice(0, 3), d => d.high);
            const highEnd = highStart + (highSlope * lastIndex / 100) * highStart;
            
            chartGroup.append('line')
                .attr('class', 'trendline high')
                .attr('x1', xScale(firstIndex))
                .attr('y1', yScale(highStart))
                .attr('x2', xScale(lastIndex))
                .attr('y2', yScale(highEnd))
                .attr('stroke', '#2196F3')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '3,3');
        }
        
        if (lowSlope !== undefined) {
            // Low trendline
            const lowStart = d3.min(data.slice(0, 3), d => d.low);
            const lowEnd = lowStart + (lowSlope * lastIndex / 100) * lowStart;
            
            chartGroup.append('line')
                .attr('class', 'trendline low')
                .attr('x1', xScale(firstIndex))
                .attr('y1', yScale(lowStart))
                .attr('x2', xScale(lastIndex))
                .attr('y2', yScale(lowEnd))
                .attr('stroke', '#2196F3')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '3,3');
        }
    }
    
    // Add invisible rect for click events
    svg.append('rect')
        .attr('width', width)
        .attr('height', height)
        .style('fill', 'none')
        .style('pointer-events', 'all')
        .on('click', () => {
            // Find index of pattern in results array
            const index = consolidationResults.findIndex(s => s.symbol === symbol);
            if (index !== -1) {
                showFullAnalysis(index);
            }
        });
    
    // Store chart instance reference
    chartInstances[symbol] = {
        chart: svg.node(),
        container: container
    };
}

// Initialize chart for support/resistance analysis
function initializeSRChart(symbol, srData) {
    const container = document.getElementById(`sr-chart-${symbol}`);
    if (!container) return;
    
    // Clear any existing content
    container.innerHTML = '';
    
    const width = container.clientWidth || 150;
    const height = container.clientHeight || 80;
    
    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');
    
    // Get price data
    const data = srData.priceData.slice(-20);
    if (data.length < 5) return;
    
    // Define margins
    const margin = { top: 5, right: 5, bottom: 5, left: 5 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Create scales
    const xScale = d3.scaleLinear()
        .domain([0, data.length - 1])
        .range([0, chartWidth]);
    
    // Find min/max including support/resistance levels
    let minPrice = d3.min(data, d => d.low);
    let maxPrice = d3.max(data, d => d.high);
    
    if (srData.srLevels && srData.srLevels.support) {
        srData.srLevels.support.forEach(level => {
            if (level && level.price !== undefined) {
                minPrice = Math.min(minPrice, level.price);
            }
        });
    }
    
    if (srData.srLevels && srData.srLevels.resistance) {
        srData.srLevels.resistance.forEach(level => {
            if (level && level.price !== undefined) {
                maxPrice = Math.max(maxPrice, level.price);
            }
        });
    }
    
    const yScale = d3.scaleLinear()
        .domain([minPrice * 0.995, maxPrice * 1.005])
        .range([chartHeight, 0]);
    
    // Create chart group
    const chartGroup = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Calculate the optimal candlestick width based on chart width and data points
    // Ensure it's at least 1 pixel to avoid negative values
    const candleWidth = Math.max(1, Math.min(4, (chartWidth / data.length) * 0.8));
    
    // Draw candlesticks
    chartGroup.selectAll('.candle')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'candle')
        .attr('x', (d, i) => xScale(i) - (candleWidth / 2))
        .attr('y', d => yScale(Math.max(d.open, d.close)))
        .attr('width', candleWidth)
        .attr('height', d => Math.max(1, Math.abs(yScale(d.open) - yScale(d.close))))
        .attr('fill', d => d.close > d.open ? '#4CAF50' : '#F44336');
    
    // Draw wicks
    chartGroup.selectAll('.wick')
        .data(data)
        .enter()
        .append('line')
        .attr('class', 'wick')
        .attr('x1', (d, i) => xScale(i))
        .attr('x2', (d, i) => xScale(i))
        .attr('y1', d => yScale(d.high))
        .attr('y2', d => yScale(d.low))
        .attr('stroke', d => d.close > d.open ? '#4CAF50' : '#F44336');
    
    // Draw support levels
    if (srData.srLevels && srData.srLevels.support) {
        srData.srLevels.support.slice(0, 3).forEach(level => {
            if (level && level.price !== undefined) {
                chartGroup.append('line')
                    .attr('class', 'support-line')
                    .attr('x1', 0)
                    .attr('x2', chartWidth)
                    .attr('y1', yScale(level.price))
                    .attr('y2', yScale(level.price))
                    .attr('stroke', '#4CAF50')
                    .attr('stroke-width', 1.5)
                    .attr('stroke-dasharray', '3,3');
                
                // Add label for strength
                chartGroup.append('text')
                    .attr('x', chartWidth - 15)
                    .attr('y', yScale(level.price) + 10)
                    .attr('fill', '#4CAF50')
                    .attr('font-size', '8px')
                    .text(`x${level.strength}`);
            }
        });
    }
    
    // Draw resistance levels
    if (srData.srLevels && srData.srLevels.resistance) {
        srData.srLevels.resistance.slice(0, 3).forEach(level => {
            if (level && level.price !== undefined) {
                chartGroup.append('line')
                    .attr('class', 'resistance-line')
                    .attr('x1', 0)
                    .attr('x2', chartWidth)
                    .attr('y1', yScale(level.price))
                    .attr('y2', yScale(level.price))
                    .attr('stroke', '#F44336')
                    .attr('stroke-width', 1.5)
                    .attr('stroke-dasharray', '3,3');
                
                // Add label for strength
                chartGroup.append('text')
                    .attr('x', chartWidth - 15)
                    .attr('y', yScale(level.price) - 5)
                    .attr('fill', '#F44336')
                    .attr('font-size', '8px')
                    .text(`x${level.strength}`);
            }
        });
    }
    
    // Mark current price with horizontal line
    if (srData.currentPrice !== undefined) {
        chartGroup.append('line')
            .attr('x1', 0)
            .attr('x2', chartWidth)
            .attr('y1', yScale(srData.currentPrice))
            .attr('y2', yScale(srData.currentPrice))
            .attr('stroke', '#2196F3')
            .attr('stroke-width', 1);
    }
    
    // Add invisible rect for click events
    svg.append('rect')
        .attr('width', width)
        .attr('height', height)
        .style('fill', 'none')
        .style('pointer-events', 'all')
        .on('click', () => {
            // Find index of stock in results array
            const index = consolidationResults.findIndex(s => s.symbol === symbol);
            if (index !== -1) {
                showFullAnalysis(index);
            }
        });
    
    // Store chart instance reference
    chartInstances[symbol] = {
        chart: svg.node(),
        container: container
    };
}

// Calculate Simple Moving Average
function calculateSMA(data, period) {
    if (data.length < period) return [];
    
    const sma = [];
    for (let i = period - 1; i < data.length; i++) {
        const sum = data.slice(i - period + 1, i + 1).reduce((total, item) => total + item.close, 0);
        sma.push(sum / period);
    }
    return sma;
}

// Calculate Standard Deviation
function calculateStandardDeviation(data, sma, period) {
    if (data.length < period || sma.length === 0) return [];
    
    const stdDev = [];
    for (let i = period - 1; i < data.length; i++) {
        const smaIndex = i - (period - 1);
        if (smaIndex < 0 || smaIndex >= sma.length) continue;
        
        const avgPrice = sma[smaIndex];
        let variance = 0;
        
        for (let j = i - period + 1; j <= i; j++) {
            variance += Math.pow(data[j].close - avgPrice, 2);
        }
        
        stdDev.push(Math.sqrt(variance / period));
    }
    return stdDev;
}

// Calculate Bollinger Band Width
function calculateBollingerBandWidth(data, period) {
    if (data.length < period) return [];
    
    const closePrices = data.map(item => item.close);
    const sma = calculateSMA(data, period);
    const stdDev = calculateStandardDeviation(data, sma, period);
    
    const bbw = [];
    for (let i = 0; i < sma.length; i++) {
        if (i >= stdDev.length) continue;
        
        const upperBand = sma[i] + 2 * stdDev[i];
        const lowerBand = sma[i] - 2 * stdDev[i];
        
        // Calculate BBW as percentage of middle band
        const width = ((upperBand - lowerBand) / sma[i]) * 100;
        bbw.push(width);
    }
    
    return bbw;
}

// Calculate Average True Range (ATR)
function calculateATR(data, period) {
    if (data.length < period + 1) return [];
    
    // Calculate True Range series first
    const trSeries = [];
    for (let i = 1; i < data.length; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const prevClose = data[i-1].close;
        
        const tr1 = high - low; // Current high - current low
        const tr2 = Math.abs(high - prevClose); // Current high - previous close
        const tr3 = Math.abs(low - prevClose); // Current low - previous close
        
        const tr = Math.max(tr1, tr2, tr3);
        trSeries.push(tr);
    }
    
    // Calculate ATR using simple moving average of TR
    const atrValues = [];
    if (trSeries.length >= period) {
        // First ATR is simple average of first 'period' TRs
        let atr = trSeries.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
        atrValues.push(atr);
        
        // Subsequent ATRs use smoothing formula: ATR = [(Prior ATR * (period-1)) + Current TR] / period
        for (let i = period; i < trSeries.length; i++) {
            atr = ((atrValues[atrValues.length - 1] * (period - 1)) + trSeries[i]) / period;
            atrValues.push(atr);
        }
    }
    
    return atrValues;
}

// Calculate trend of a data series (positive/negative/neutral)
function calculateTrend(data) {
    if (data.length < 5) return 0; // Not enough data
    
    // Use last 5 values to determine recent trend
    const recent = data.slice(-5);
    
    // Simple linear regression
    const x = Array.from({ length: recent.length }, (_, i) => i);
    const y = recent;
    
    // Calculate means
    const meanX = x.reduce((sum, val) => sum + val, 0) / x.length;
    const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;
    
    // Calculate slope
    const numerator = x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0);
    const denominator = x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0);
    
    // Return slope (positive = increasing, negative = decreasing)
    return denominator !== 0 ? numerator / denominator : 0;
}

// Calculate volume trend (positive/negative/neutral)
function calculateVolumeTrend(data) {
    if (data.length < 5) return 0;
    
    // Use volume data
    const volumes = data.slice(-5).map(item => item.volume);
    
    // Simple linear regression on volume
    const x = Array.from({ length: volumes.length }, (_, i) => i);
    
    // Calculate means
    const meanX = x.reduce((sum, val) => sum + val, 0) / x.length;
    const meanY = volumes.reduce((sum, val) => sum + val, 0) / volumes.length;
    
    // Calculate slope
    const numerator = x.reduce((sum, val, i) => sum + (val - meanX) * (volumes[i] - meanY), 0);
    const denominator = x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0);
    
    // Return slope (positive = increasing, negative = decreasing)
    return denominator !== 0 ? numerator / denominator : 0;
}

// Calculate price range as a percentage
function calculatePriceRange(data) {
    const highestHigh = Math.max(...data.map(d => d.high));
    const lowestLow = Math.min(...data.map(d => d.low));
    const avgPrice = data.reduce((sum, d) => sum + d.close, 0) / data.length;
    
    return ((highestHigh - lowestLow) / avgPrice) * 100;
}

// Calculate how many days the price has stayed within a range
function calculateDaysInRange(data) {
    if (data.length < 5) return 0;
    
    const recentData = data.slice(-5);
    const medianPrice = recentData.reduce((sum, d) => sum + d.close, 0) / recentData.length;
    
    // Check how many days are within 2% of median
    let daysInRange = 0;
    for (const day of recentData) {
        const deviation = Math.abs((day.close - medianPrice) / medianPrice) * 100;
        if (deviation <= 2) daysInRange++;
    }
    
    return daysInRange;
}

// Calculate closeness to previous high (resistance)
function calculateClosenessToPreviousHigh(data, currentPrice) {
    if (data.length < 10) return 0;
    
    // Find highest high in the period
    const highestHigh = Math.max(...data.map(d => d.high));
    
    // Calculate percentage distance to high
    return ((highestHigh - currentPrice) / currentPrice) * 100;
}

// Linear regression utility function
function linearRegression(data) {
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    let n = data.length;
    
    // Calculate the sums needed for the regression formula
    for (let i = 0; i < n; i++) {
        sumX += data[i].x;
        sumY += data[i].y;
        sumXY += data[i].x * data[i].y;
        sumXX += data[i].x * data[i].x;
    }
    
    // Calculate slope and intercept
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
}