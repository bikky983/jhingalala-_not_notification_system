// Enhanced Trendline Scanner
// Constants
const DEFAULT_LOOKBACK_PERIOD = 60;
const DEFAULT_MIN_TOUCHES = 3;
const DEFAULT_PROXIMITY_THRESHOLD = 2;
const DEFAULT_ATR_MULTIPLIER = 0.5;
const DEFAULT_MIN_TREND_DURATION = 14;
const DEFAULT_MIN_TREND_QUALITY = 'medium';
const DEFAULT_REQUIRE_VOLUME = true;
const NEW_BADGE_DAYS = 3;
const REFRESH_BUTTON_ID = 'refreshListBtn';
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Global variables
let stockHistoricalData = {};
let currentPrices = {};
let availableStocks = [];
let trendlineStocks = [];
let trendlineStocksHistory = {};
let boughtStocks = [];
let userStocks = [];
let isAutoRefreshEnabled = false;
let autoRefreshInterval = null;

// Initialize the page when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Enhanced Trendline Scanner initializing...');
    
    // Initialize application
    initializePage();
    setupEventListeners();
    
    // Load data
    loadUserStocks();
    
    // Create chart popup if not exists
    if (!document.querySelector('.chart-popup')) {
        createChartPopup();
    }
    
    // Register our direct watchlist functions globally
    window.isInWatchlist = isInWatchlist;
    window.toggleWatchlist = toggleWatchlist;
    
    // Add watchlist styles
    addWatchlistStyles();
    
    // Start application
    fetchHistoricalData();
    
    // Setup auto refresh
    setupAutoRefresh();
    
    // Setup tab navigation
    setupTabs();
});

function createChartPopup() {
    // No need to recreate if already in HTML
    if (document.getElementById('chartPopup')) {
        return;
    }
    
    const popupElement = document.createElement('div');
    popupElement.className = 'chart-popup';
    popupElement.id = 'chartPopup';
    popupElement.style.display = 'none';
    popupElement.innerHTML = `
        <div class="chart-popup-content">
            <div class="chart-popup-header">
                <h3 id="chartTitle">Stock Chart</h3>
                <button id="chartPopupClose" class="chart-popup-close">&times;</button>
            </div>
            <div class="chart-popup-body">
                <div id="chartContainer"></div>
            </div>
        </div>
    `;
    document.body.appendChild(popupElement);
}

function initializePage() {
    // Load bought stocks
    loadBoughtStocks();
    
    // Load saved filter settings
    loadSavedFilterSettings();
    
    // Check and load trendline stocks history from localStorage
    const savedHistory = localStorage.getItem('enhancedTrendlineStocksHistory');
    if (savedHistory) {
        trendlineStocksHistory = JSON.parse(savedHistory);
    }
    
    // Add this line to ensure historical data is loaded
    fetchHistoricalData();
}

function setupEventListeners() {
    // Setup filter event listeners
    document.getElementById('lookbackPeriod').addEventListener('change', saveFilterSettings);
    document.getElementById('minTouches').addEventListener('change', saveFilterSettings);
    document.getElementById('proximityThreshold').addEventListener('change', saveFilterSettings);
    document.getElementById('atrMultiplier').addEventListener('change', saveFilterSettings);
    document.getElementById('minTrendDuration').addEventListener('change', saveFilterSettings);
    document.getElementById('minTrendQuality').addEventListener('change', saveFilterSettings);
    document.getElementById('requireVolumeConfirmation').addEventListener('change', saveFilterSettings);
    
    document.querySelectorAll('input[name="trendDirection"]').forEach(radio => {
        radio.addEventListener('change', saveFilterSettings);
    });
    
    document.getElementById('showBoughtStocks').addEventListener('change', saveFilterSettings);
    document.getElementById('showWatchlistOnly').addEventListener('change', saveFilterSettings);
    
    // Refresh button
    document.getElementById(REFRESH_BUTTON_ID).addEventListener('click', function() {
        refreshStockList();
    });
    
    // Setup add to watchlist button
    document.getElementById('addToWatchlistButton').addEventListener('click', function() {
        addSelectedToWatchlist();
    });
    
    // Setup close chart popup button - Fix: use class selector instead of id
    const closeButton = document.querySelector('.chart-popup-close');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            hideChartPopup();
        });
    }
    
    // Setup auto refresh toggle
    document.getElementById('autoRefreshToggle').addEventListener('change', function() {
        toggleAutoRefresh();
    });
    
    // Add window resize listener
    window.addEventListener('resize', handleWindowResize);
}

function setupTabs() {
    // Add click handlers for tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs and content
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Show corresponding content
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId + 'Tab').classList.add('active');
            
            // If showing breakdown tab, generate charts
            if (tabId === 'breakdown') {
                generateTrendQualityChart();
                generateTrendDurationChart();
            }
        });
    });
}

function loadSavedFilterSettings() {
    // Load saved filter settings from localStorage
    const savedSettings = localStorage.getItem('enhancedTrendlineScannerSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        
        // Apply saved settings to form elements
        if (settings.lookbackPeriod) {
            document.getElementById('lookbackPeriod').value = settings.lookbackPeriod;
        }
        
        if (settings.minTouches) {
            document.getElementById('minTouches').value = settings.minTouches;
        }
        
        if (settings.proximityThreshold) {
            document.getElementById('proximityThreshold').value = settings.proximityThreshold;
        }
        
        if (settings.atrMultiplier) {
            document.getElementById('atrMultiplier').value = settings.atrMultiplier;
        }
        
        if (settings.minTrendDuration) {
            document.getElementById('minTrendDuration').value = settings.minTrendDuration;
        }
        
        if (settings.minTrendQuality) {
            document.getElementById('minTrendQuality').value = settings.minTrendQuality;
        }
        
        if (settings.requireVolumeConfirmation !== undefined) {
            document.getElementById('requireVolumeConfirmation').checked = settings.requireVolumeConfirmation;
        }
        
        if (settings.trendDirection) {
            document.querySelector(`input[name="trendDirection"][value="${settings.trendDirection}"]`).checked = true;
        }
        
        if (settings.showBoughtStocks !== undefined) {
            document.getElementById('showBoughtStocks').checked = settings.showBoughtStocks;
        }
        
        if (settings.showWatchlistOnly !== undefined) {
            document.getElementById('showWatchlistOnly').checked = settings.showWatchlistOnly;
        }
    }
}

function saveFilterSettings() {
    try {
        // Get values from form
        const settings = {
            lookbackPeriod: document.getElementById('lookbackPeriod').value,
            minTouches: document.getElementById('minTouches').value,
            proximityThreshold: document.getElementById('proximityThreshold').value,
            atrMultiplier: document.getElementById('atrMultiplier').value,
            minTrendDuration: document.getElementById('minTrendDuration').value,
            minTrendQuality: document.getElementById('minTrendQuality').value,
            requireVolumeConfirmation: document.getElementById('requireVolumeConfirmation').checked,
            trendDirection: document.querySelector('input[name="trendDirection"]:checked').value,
            showBoughtStocks: document.getElementById('showBoughtStocks').checked,
            showWatchlistOnly: document.getElementById('showWatchlistOnly').checked
        };
        
        // Save to localStorage
        localStorage.setItem('enhancedTrendlineScannerSettings', JSON.stringify(settings));
        
        // Refresh the display if needed
        filterTrendlineStocks();
    } catch (error) {
        console.error('Error saving filter settings:', error);
    }
}

function loadBoughtStocks() {
    // Load bought stocks from localStorage
    const savedStocks = localStorage.getItem('boughtStocks');
    if (savedStocks) {
        boughtStocks = JSON.parse(savedStocks);
    }
}

function loadUserStocks() {
    // Load user stocks from localStorage
    userStocks = [];
    
    // Try to load from userStocks format
    const savedStocks = localStorage.getItem('userStocks');
    if (savedStocks) {
        try {
            userStocks = JSON.parse(savedStocks);
            console.log(`Loaded ${userStocks.length} user stocks from localStorage (userStocks format)`);
        } catch (e) {
            console.error('Error parsing userStocks:', e);
        }
    }
    
    // Also check watchlist format for compatibility
    const watchlist = localStorage.getItem('watchlist');
    if (watchlist) {
        try {
            const watchlistArray = JSON.parse(watchlist);
            
            // Add any stocks from watchlist that aren't already in userStocks
            watchlistArray.forEach(symbol => {
                if (!userStocks.some(stock => stock.symbol === symbol)) {
                    userStocks.push({
                        symbol: symbol,
                        addedOn: new Date().toISOString()
                    });
                }
            });
            
            console.log(`Loaded ${watchlistArray.length} additional stocks from watchlist format`);
        } catch (e) {
            console.error('Error parsing watchlist:', e);
        }
    }
    
    // Also load bought stocks for compatibility
    loadBoughtStocks();
}

function refreshStockList() {
    showLoading(true);
    
    // Fetch current prices and then filter stocks
    loadCurrentPrices()
        .then(() => {
            filterTrendlineStocks();
            updateLastRefreshTime();
        })
        .catch(error => {
            showError('Error refreshing stock list: ' + error.message);
            showLoading(false);
        });
}

function loadCurrentPrices() {
    return new Promise((resolve, reject) => {
        try {
            // Load current prices from localStorage (set by dashboard)
            const storedPrices = localStorage.getItem('currentPrices');
            if (storedPrices) {
                currentPrices = JSON.parse(storedPrices);
                resolve();
            } else {
                // Fallback to API if not available in localStorage
                fetchCurrentPricesFromAPI()
                    .then(resolve)
                    .catch(reject);
            }
        } catch (error) {
            console.error('Error loading current prices:', error);
            reject(new Error('Failed to load current prices'));
        }
    });
}

async function fetchCurrentPricesFromAPI() {
    try {
        console.log("Attempting to fetch current prices from API...");
        const response = await fetch('/api/prices');
        if (!response.ok) {
            // Try fallback to localStorage first
            console.log("API fetch failed, trying localStorage...");
            const storedPrices = localStorage.getItem('currentPrices');
            if (storedPrices) {
                currentPrices = JSON.parse(storedPrices);
                console.log(`Loaded ${Object.keys(currentPrices).length} prices from localStorage`);
                return;
            }
            
            // If no localStorage prices, try to generate dummy prices from historical data
            console.log("No localStorage prices, generating prices from historical data...");
            if (Object.keys(stockHistoricalData).length > 0) {
                Object.keys(stockHistoricalData).forEach(symbol => {
                    const data = stockHistoricalData[symbol];
                    if (data && data.length > 0) {
                        // Use last close price as current price
                        currentPrices[symbol] = data[data.length - 1].close;
                    }
                });
                console.log(`Generated ${Object.keys(currentPrices).length} prices from historical data`);
                return;
            }
            
            throw new Error('Failed to fetch prices and no fallback available');
        }
        
        const data = await response.json();
        console.log(`Received prices data from API: ${typeof data}`);
        
        // Handle different data formats
        if (typeof data === 'object') {
            if (Array.isArray(data)) {
                // Handle array format
                data.forEach(item => {
                    if (item.symbol && item.price) {
                        currentPrices[item.symbol] = parseFloat(item.price);
                    }
                });
            } else {
                // Handle object format
                currentPrices = data;
            }
        }
        
        console.log(`Processed ${Object.keys(currentPrices).length} prices from API`);
        
        // Save to localStorage for other pages to use
        localStorage.setItem('currentPrices', JSON.stringify(currentPrices));
    } catch (error) {
        console.error('Error fetching prices:', error);
        
        // Try to use stored prices anyway
        const storedPrices = localStorage.getItem('currentPrices');
        if (storedPrices) {
            currentPrices = JSON.parse(storedPrices);
            console.log(`Fallback: loaded ${Object.keys(currentPrices).length} prices from localStorage`);
        } else {
            throw new Error('Failed to fetch current prices');
        }
    }
}

async function fetchHistoricalData() {
    try {
        showLoading(true);
        console.log("Attempting to fetch historical data...");
        const response = await fetch('/organized_nepse_data.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Historical data received. Total records: ${data.length}`);
        
        // Process the data
        processHistoricalData(data);
        
        // Make sure user stocks are loaded before filtering
        loadUserStocks();
        
        // Generate current prices from historical data
        generateCurrentPricesFromHistorical();
        
        // After processing, filter stocks
        filterTrendlineStocks();
        
        showLoading(false);
    } catch (error) {
        console.error('Error fetching historical data:', error);
        showError('Failed to load historical price data: ' + error.message);
        showLoading(false);
    }
}

function processHistoricalData(data) {
    // Reset the historical data object
    stockHistoricalData = {};
    availableStocks = [];
    
    // Check if data is an array
    if (!Array.isArray(data)) {
        console.error("Data is not an array:", data);
        showError("Historical data format is invalid");
        return;
    }
    
    // Create a more efficient data structure
    data.forEach(item => {
        // Extract the symbol
        const symbol = item.symbol;
        
        // Skip if missing data
        if (!symbol || item.open === undefined || item.high === undefined || 
            item.low === undefined || item.close === undefined) {
            return;
        }
        
        // Initialize array for this symbol if needed
        if (!stockHistoricalData[symbol]) {
            stockHistoricalData[symbol] = [];
            availableStocks.push(symbol);
        }
        
        // Add the data point
        stockHistoricalData[symbol].push({
            date: item.time || new Date().toISOString(),
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close),
            volume: parseFloat(item.volume || 0)
        });
    });
    
    console.log(`Processed data for ${availableStocks.length} symbols. First few symbols: ${availableStocks.slice(0, 5).join(', ')}`);
    
    if (availableStocks.length === 0) {
        showError('No valid historical data found for any stocks');
    }
}

function filterTrendlineStocks() {
    trendlineStocks = [];
    
    // Get filter settings
    const lookbackPeriod = parseInt(document.getElementById('lookbackPeriod').value) || DEFAULT_LOOKBACK_PERIOD;
    const minTouches = parseInt(document.getElementById('minTouches').value) || DEFAULT_MIN_TOUCHES;
    const proximityThreshold = parseFloat(document.getElementById('proximityThreshold').value) || DEFAULT_PROXIMITY_THRESHOLD;
    const atrMultiplier = parseFloat(document.getElementById('atrMultiplier').value) || DEFAULT_ATR_MULTIPLIER;
    const trendDirection = document.querySelector('input[name="trendDirection"]:checked').value;
    const minTrendDuration = parseInt(document.getElementById('minTrendDuration').value) || DEFAULT_MIN_TREND_DURATION;
    const minTrendQuality = document.getElementById('minTrendQuality').value || DEFAULT_MIN_TREND_QUALITY;
    const requireVolumeConfirmation = document.getElementById('requireVolumeConfirmation').checked;
    const showBoughtStocks = document.getElementById('showBoughtStocks').checked;
    const showWatchlistOnly = document.getElementById('showWatchlistOnly').checked;
    
    // Load user stocks from dashboard
    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    
    console.log(`Filtering with enhanced settings: lookback=${lookbackPeriod}, minTouches=${minTouches}, proximity=${proximityThreshold}, atrMultiplier=${atrMultiplier}, direction=${trendDirection}, minDuration=${minTrendDuration}, quality=${minTrendQuality}, volumeConfirm=${requireVolumeConfirmation}`);
    console.log(`Total stocks to process: ${Object.keys(stockHistoricalData).length}`);
    console.log(`Current prices available for ${Object.keys(currentPrices).length} stocks`);
    
    // Process each stock
    Object.keys(stockHistoricalData).forEach(symbol => {
        // If dashboard stocks only is checked, skip non-dashboard stocks
        if (showWatchlistOnly) {
            // Check if stock exists in userStocks (dashboard stocks)
            if (!userStocks.some(stock => stock.symbol === symbol)) {
                return;
            }
        }
        
        // Skip if no historical data or not enough data points
        if (!stockHistoricalData[symbol] || stockHistoricalData[symbol].length < lookbackPeriod) {
            return;
        }
        
        // Skip if no current price
        if (!currentPrices[symbol]) {
            return;
        }
        
        // Get current price
        const currentPrice = currentPrices[symbol];
        
        // Skip if current price is not valid
        if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) {
            return;
        }
        
        // Get historical price data for the lookback period
        const priceData = stockHistoricalData[symbol].slice(-lookbackPeriod);
        
        // Skip if not enough data
        if (priceData.length < lookbackPeriod) {
            return;
        }
        
        // Calculate ATR for adaptive touch thresholds
        const atr = calculateATR(priceData);
        const adaptiveThreshold = priceData[priceData.length - 1].close * (atrMultiplier * atr / 100);
        
        // Handle 'both' direction separately
        if (trendDirection === 'both') {
            // Check for uptrend
            const uptrendResult = detectEnhancedTrendline(priceData, 'up', minTouches, adaptiveThreshold, minTrendDuration);
            if (uptrendResult) {
                // Check volume confirmation if required
                const volumeConfirmed = !requireVolumeConfirmation || confirmVolumeSupport(priceData, uptrendResult, 'up');
                
                if (volumeConfirmed) {
                    // Calculate trendline value and distance
                    const trendlineValue = calculateTrendlineValue(uptrendResult.slope, uptrendResult.intercept, priceData.length - 1);
                    const distance = calculateDistance(currentPrice, trendlineValue);
                    
                    // Check proximity
                    if (Math.abs(distance) <= proximityThreshold) {
                        // Check trend quality
                        if (uptrendResult.quality >= minTrendQuality) {
                            // Add to filtered stocks
                            addTrendlineStock(symbol, currentPrice, trendlineValue, distance, 'up', 
                                          uptrendResult.touches, uptrendResult.slope, 
                                          uptrendResult.intercept, uptrendResult.touchPoints,
                                          uptrendResult.quality, uptrendResult.volumeScore,
                                          uptrendResult.duration, showBoughtStocks);
                        }
                    }
                }
            }
            
            // Check for downtrend
            const downtrendResult = detectEnhancedTrendline(priceData, 'down', minTouches, adaptiveThreshold, minTrendDuration);
            if (downtrendResult) {
                // Check volume confirmation if required
                const volumeConfirmed = !requireVolumeConfirmation || confirmVolumeSupport(priceData, downtrendResult, 'down');
                
                if (volumeConfirmed) {
                    // Calculate trendline value and distance
                    const trendlineValue = calculateTrendlineValue(downtrendResult.slope, downtrendResult.intercept, priceData.length - 1);
                    const distance = calculateDistance(currentPrice, trendlineValue);
                    
                    // Check proximity
                    if (Math.abs(distance) <= proximityThreshold) {
                        // Check trend quality
                        if (downtrendResult.quality >= minTrendQuality) {
                            // Add to filtered stocks
                            addTrendlineStock(symbol, currentPrice, trendlineValue, distance, 'down', 
                                          downtrendResult.touches, downtrendResult.slope, 
                                          downtrendResult.intercept, downtrendResult.touchPoints,
                                          downtrendResult.quality, downtrendResult.volumeScore,
                                          downtrendResult.duration, showBoughtStocks);
                        }
                    }
                }
            }
        } else {
            // Process single direction
            const trendlineResult = detectEnhancedTrendline(priceData, trendDirection, minTouches, adaptiveThreshold, minTrendDuration);
            
            // Skip if no valid trendline found
            if (!trendlineResult) {
                return;
            }
            
            // Check volume confirmation if required
            const volumeConfirmed = !requireVolumeConfirmation || confirmVolumeSupport(priceData, trendlineResult, trendDirection);
            
            if (!volumeConfirmed) {
                return;
            }
            
            // Check trend quality
            if (trendlineResult.quality < minTrendQuality) {
                return;
            }
            
            // Get trendline values
            const { slope, intercept, touchPoints, touches, quality, volumeScore, duration } = trendlineResult;
            
            // Calculate trendline value at the current index (last price data point)
            const trendlineValue = calculateTrendlineValue(slope, intercept, priceData.length - 1);
            
            // Calculate distance from current price to trendline as percentage
            const distance = calculateDistance(currentPrice, trendlineValue);
            
            // Filter based on proximity threshold
            if (Math.abs(distance) > proximityThreshold) {
                return;
            }
            
            // Add to filtered stocks
            addTrendlineStock(symbol, currentPrice, trendlineValue, distance, trendDirection, 
                          touches, slope, intercept, touchPoints, quality, volumeScore,
                          duration, showBoughtStocks);
        }
    });
    
    console.log(`Found ${trendlineStocks.length} stocks matching the enhanced trendline criteria`);
    
    // Sort stocks by trend quality first, then by proximity to trendline
    trendlineStocks.sort((a, b) => {
        // First sort by quality (strong > medium > weak)
        const qualityValue = { 'strong': 3, 'medium': 2, 'weak': 1 };
        const qualityDiff = qualityValue[b.quality] - qualityValue[a.quality];
        
        if (qualityDiff !== 0) {
            return qualityDiff;
        }
        
        // Then by proximity to trendline (closest first)
        return Math.abs(a.distance) - Math.abs(b.distance);
    });
    
    // Save filtered stocks to history
    saveFilteredStocksToHistory();
    
    // Update the display
    displayTrendlineStocks();
    updateStockCounters();
    
    // Hide loading indicator
    showLoading(false);
}

// Helper function to add stocks to the trendlineStocks array
function addTrendlineStock(symbol, currentPrice, trendlineValue, distance, direction, 
                          touches, slope, intercept, touchPoints, quality, volumeScore,
                          duration, showBoughtStocks) {
    // Check if the stock is bought
    const isBought = isBoughtStock(symbol);
    
    // Skip if it's a bought stock and we're not showing them
    if (isBought && !showBoughtStocks) {
        return;
    }
    
    // Check if this stock is newly filtered
    const isNew = isNewFiltered(symbol, direction);
    
    // Add to filtered stocks
    trendlineStocks.push({
        symbol,
        currentPrice,
        trendlineValue,
        distance,
        direction,
        touches,
        isNew,
        isBought,
        slope,
        intercept,
        touchPoints,
        quality,
        volumeScore,
        duration
    });
}

// Enhanced trendline detection with additional metrics
function detectEnhancedTrendline(priceData, direction, minTouches, adaptiveThreshold, minTrendDuration) {
    // Find extreme points based on trend direction
    const extremePoints = findExtremePoints(priceData, direction);
    
    // Skip if not enough extreme points
    if (extremePoints.length < 2) {
        return null;
    }
    
    // Perform linear regression to find trendline
    const { slope, intercept } = linearRegression(extremePoints);
    
    // Skip if slope doesn't match the trend direction
    if ((direction === 'up' && slope <= 0) || (direction === 'down' && slope >= 0)) {
        return null;
    }
    
    // Count how many times price touches the trendline
    const { touches, touchPoints } = countTouches(priceData, slope, intercept, direction, adaptiveThreshold);
    
    // Skip if not enough touches
    if (touches < minTouches) {
        return null;
    }
    
    // Calculate trend duration in days
    const duration = calculateTrendDuration(touchPoints);
    
    // Skip if trend duration is too short
    if (duration < minTrendDuration) {
        return null;
    }
    
    // Calculate trend quality score
    const quality = calculateTrendQuality(touches, duration, extremePoints.length, slope);
    
    // Calculate volume score
    const volumeScore = calculateVolumeScore(priceData, direction);
    
    // Return enhanced trendline information
    return {
        slope,
        intercept,
        touches,
        touchPoints,
        quality,
        volumeScore,
        duration
    };
}

function findExtremePoints(priceData, direction) {
    const extremePoints = [];
    
    // For uptrend, we need to find local minima
    // For downtrend, we need to find local maxima
    if (direction === 'up') {
        // Find local minima (potential support points)
        for (let i = 1; i < priceData.length - 1; i++) {
            // Local minimum if both neighbors are higher
            if (priceData[i].low <= priceData[i - 1].low && priceData[i].low <= priceData[i + 1].low) {
                extremePoints.push({
                    index: i,
                    value: priceData[i].low
                });
            }
        }
        
        // Include first and last point if they are lower
        if (priceData.length > 0 && (extremePoints.length === 0 || priceData[0].low < extremePoints[0].value)) {
            extremePoints.unshift({
                index: 0,
                value: priceData[0].low
            });
        }
        
        const lastIndex = priceData.length - 1;
        if (priceData.length > 0 && (extremePoints.length === 0 || priceData[lastIndex].low < extremePoints[extremePoints.length - 1].value)) {
            extremePoints.push({
                index: lastIndex,
                value: priceData[lastIndex].low
            });
        }
    } else {
        // Find local maxima (potential resistance points)
        for (let i = 1; i < priceData.length - 1; i++) {
            // Local maximum if both neighbors are lower
            if (priceData[i].high >= priceData[i - 1].high && priceData[i].high >= priceData[i + 1].high) {
                extremePoints.push({
                    index: i,
                    value: priceData[i].high
                });
            }
        }
        
        // Include first and last point if they are higher
        if (priceData.length > 0 && (extremePoints.length === 0 || priceData[0].high > extremePoints[0].value)) {
            extremePoints.unshift({
                index: 0,
                value: priceData[0].high
            });
        }
        
        const lastIndex = priceData.length - 1;
        if (priceData.length > 0 && (extremePoints.length === 0 || priceData[lastIndex].high > extremePoints[extremePoints.length - 1].value)) {
            extremePoints.push({
                index: lastIndex,
                value: priceData[lastIndex].high
            });
        }
    }
    
    return extremePoints;
}

function linearRegression(points) {
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    const n = points.length;
    
    // Calculate sums needed for linear regression formula
    for (let i = 0; i < n; i++) {
        const x = points[i].index;
        const y = points[i].value;
        
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    }
    
    // Calculate slope (m) and intercept (b) for the line equation: y = mx + b
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
}

function calculateATR(priceData) {
    let sumTR = 0;
    
    // Calculate True Range for the lookback period (usually 14 days)
    for (let i = 1; i < Math.min(15, priceData.length); i++) {
        const currentHigh = priceData[i].high;
        const currentLow = priceData[i].low;
        const previousClose = priceData[i - 1].close;
        
        // True Range is the greatest of the following:
        // 1. Current High - Current Low
        // 2. |Current High - Previous Close|
        // 3. |Current Low - Previous Close|
        const tr = Math.max(
            currentHigh - currentLow,
            Math.abs(currentHigh - previousClose),
            Math.abs(currentLow - previousClose)
        );
        
        sumTR += tr;
    }
    
    // Calculate average (14-period ATR is common)
    const period = Math.min(14, priceData.length - 1);
    const atr = sumTR / period;
    
    // Return ATR as percentage of price for easier use with proximity threshold
    return (atr / priceData[priceData.length - 1].close) * 100;
}

function countTouches(priceData, slope, intercept, direction, touchThreshold) {
    let touches = 0;
    const touchPoints = [];
    
    for (let i = 0; i < priceData.length; i++) {
        // Calculate trendline value at this index
        const trendlineValue = slope * i + intercept;
        
        // Check if price touches the trendline based on direction
        if (direction === 'up') {
            // For uptrend, check if low price is close to trendline
            const distance = Math.abs(priceData[i].low - trendlineValue);
            
            if (distance <= touchThreshold) {
                touches++;
                touchPoints.push({
                    index: i,
                    value: priceData[i].low,
                    date: priceData[i].date
                });
                
                // Skip nearby points to avoid double counting
                i += 1;
            }
        } else {
            // For downtrend, check if high price is close to trendline
            const distance = Math.abs(priceData[i].high - trendlineValue);
            
            if (distance <= touchThreshold) {
                touches++;
                touchPoints.push({
                    index: i,
                    value: priceData[i].high,
                    date: priceData[i].date
                });
                
                // Skip nearby points to avoid double counting
                i += 1;
            }
        }
    }
    
    return { touches, touchPoints };
}

// Calculate the duration of the trend (days between first and last touch)
function calculateTrendDuration(touchPoints) {
    if (touchPoints.length < 2) {
        return 0;
    }
    
    // Get first and last touch point
    const firstTouch = touchPoints[0];
    const lastTouch = touchPoints[touchPoints.length - 1];
    
    // Calculate index difference
    return lastTouch.index - firstTouch.index;
}

// Calculate trend quality based on multiple factors
function calculateTrendQuality(touches, duration, extremePoints, slope) {
    // Calculate base score (0-100)
    let score = 0;
    
    // More touches = stronger trend (up to 40 points)
    score += Math.min(touches * 10, 40);
    
    // Longer duration = stronger trend (up to 30 points)
    score += Math.min(duration / 3, 30);
    
    // More extreme points = more validation points (up to 20 points)
    score += Math.min(extremePoints * 5, 20);
    
    // Steeper slope = stronger trend signal (up to 10 points)
    score += Math.min(Math.abs(slope) * 100, 10);
    
    // Convert score to quality category
    if (score >= 75) {
        return 'strong';
    } else if (score >= 50) {
        return 'medium';
    } else {
        return 'weak';
    }
}

// Calculate a volume score to confirm trend validity
function calculateVolumeScore(priceData, direction) {
    let score = 0;
    
    // Check if volume increases on trend-confirming moves
    for (let i = 1; i < priceData.length; i++) {
        const prevBar = priceData[i - 1];
        const currBar = priceData[i];
        
        // For uptrend, look for higher volume on up days
        if (direction === 'up') {
            if (currBar.close > prevBar.close && currBar.volume > prevBar.volume) {
                score += 1;
            }
        } 
        // For downtrend, look for higher volume on down days
        else {
            if (currBar.close < prevBar.close && currBar.volume > prevBar.volume) {
                score += 1;
            }
        }
    }
    
    // Normalize score to 0-100 range
    return Math.min(100, (score / (priceData.length / 5)) * 100);
}

// Confirm if volume supports the trendline
function confirmVolumeSupport(priceData, trendlineResult, direction) {
    // A score above 25 indicates some volume confirmation
    return trendlineResult.volumeScore >= 25;
}

function calculateTrendlineValue(slope, intercept, index) {
    return slope * index + intercept;
}

function calculateDistance(currentPrice, trendlineValue) {
    return ((currentPrice - trendlineValue) / trendlineValue * 100).toFixed(2);
}

function isBoughtStock(symbol) {
    return boughtStocks.includes(symbol);
}

function isNewFiltered(symbol, direction) {
    const now = new Date();
    const newThreshold = new Date(now.setDate(now.getDate() - NEW_BADGE_DAYS));
    
    // Check if stock was added to the filtered list within the last NEW_BADGE_DAYS
    if (trendlineStocksHistory[symbol]) {
        const lastFiltered = new Date(trendlineStocksHistory[symbol].timestamp);
        const lastDirection = trendlineStocksHistory[symbol].direction;
        
        // Only show as new if found with the same direction
        return lastFiltered > newThreshold && lastDirection === direction;
    }
    
    // If not in history, it's new
    return true;
}

function showLoading(isLoading) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const refreshButton = document.getElementById(REFRESH_BUTTON_ID);
    
    if (isLoading) {
        loadingIndicator.style.display = 'flex';
        refreshButton.disabled = true;
    } else {
        loadingIndicator.style.display = 'none';
        refreshButton.disabled = false;
    }
}

function showError(message) {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `<div class="error-message">${message}</div>`;
    
    // Clear message after 5 seconds
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

function showSuccess(message) {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `<div class="success-message">${message}</div>`;
    
    // Clear message after 5 seconds
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

function updateLastRefreshTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById('lastUpdated').textContent = timeString;
}

function updateStockCounters() {
    // Update total count
    document.getElementById('stockCount').textContent = trendlineStocks.length;
    
    // Count uptrends and downtrends
    const uptrends = trendlineStocks.filter(stock => stock.direction === 'up').length;
    const downtrends = trendlineStocks.filter(stock => stock.direction === 'down').length;
    
    // Update trend counters
    document.getElementById('uptrendCount').textContent = uptrends;
    document.getElementById('downtrendCount').textContent = downtrends;
}

function displayTrendlineStocks() {
    const tableBody = document.getElementById('trendlineTableBody');
    tableBody.innerHTML = '';
    
    if (trendlineStocks.length === 0) {
        showNoStocksMessage();
        return;
    }
    
    // Display each stock in the table
    trendlineStocks.forEach(stock => {
        const row = document.createElement('tr');
        
        // Add data-symbol attribute for easier selection
        row.setAttribute('data-symbol', stock.symbol);
        
        // Check if stock is in watchlist and add the class if it is
        const isWatchlisted = isInWatchlist(stock.symbol);
        if (isWatchlisted) {
            row.classList.add('watchlist-item');
        }
        
        // Add new badge if stock is newly filtered
        let symbolText = stock.symbol;
        if (stock.isNew) {
            symbolText = `${stock.symbol} <span class="new-badge">NEW</span>`;
        }
        
        // Add bought indicator if stock is bought
        if (stock.isBought) {
            symbolText = `${symbolText} <span class="bought-indicator">👜</span>`;
        }
        
        // Get trend quality badge
        const qualityBadge = `<span class="trend-quality ${stock.quality}">${stock.quality}</span>`;
        
        // Get volume confirmation badge
        const volumeBadge = stock.volumeScore >= 60 ? 
            `<span class="volume-confirmation">Vol++</span>` : 
            (stock.volumeScore >= 25 ? `<span class="volume-confirmation">Vol+</span>` : '');
        
        // Build the table row
        row.innerHTML = `
            <td><input type="checkbox" class="stock-checkbox" data-symbol="${stock.symbol}"></td>
            <td><a href="#" class="stock-link" data-symbol="${stock.symbol}">${symbolText}</a></td>
            <td class="numeric">${stock.currentPrice.toFixed(2)}</td>
            <td class="numeric">${stock.trendlineValue.toFixed(2)}</td>
            <td class="numeric ${getDistanceClass(stock.distance)}">${stock.distance}%</td>
            <td>${getTrendDirectionIcon(stock.direction)}</td>
            <td class="numeric">${stock.touches}</td>
            <td>${qualityBadge}</td>
            <td>${volumeBadge}</td>
            <td>
                <button class="watchlist-btn ${isWatchlisted ? 'active' : ''}" 
                        data-watchlist="${stock.symbol}"
                        title="${isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}">
                    ${isWatchlisted ? '★' : '☆'}
                </button>
            </td>
            <td><div class="mini-chart" id="miniChart-${stock.symbol}"></div></td>
        `;
        
        tableBody.appendChild(row);
        
        // Add click handler for stock symbol to show chart
        row.querySelector('.stock-link').addEventListener('click', function(e) {
            e.preventDefault();
            showFullScreenChart(this.getAttribute('data-symbol'));
        });
        
        // Add click handler for watchlist button
        const watchlistBtn = row.querySelector(`.watchlist-btn[data-watchlist="${stock.symbol}"]`);
        if (watchlistBtn) {
            watchlistBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleWatchlist(stock.symbol);
            });
        }
        
        // Create mini chart
        createMiniChart(stock.symbol, stock);
    });
    
    // Update stock count
    updateStockCounters();
}

function createMiniChart(symbol, stockData) {
    // Get historical data for the stock
    const historicalData = stockHistoricalData[symbol];
    if (!historicalData || historicalData.length === 0) return;
    
    const lookbackPeriod = parseInt(document.getElementById('lookbackPeriod').value) || DEFAULT_LOOKBACK_PERIOD;
    const chartData = historicalData.slice(-lookbackPeriod);
    
    const container = document.getElementById(`miniChart-${symbol}`);
    if (!container) return; // Skip if container doesn't exist
    
    // Set fixed dimensions for consistency
    const width = 150;
    const height = 50;
    const margin = { top: 2, right: 2, bottom: 2, left: 2 };
    
    // Clear previous chart
    container.innerHTML = '';
    
    // Setup SVG with fixed dimensions
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet'); // This helps with consistency
    
    // Add background for better visibility
    svg.append('rect')
        .attr('width', width)
        .attr('height', height)
        .attr('fill', '#f8f9fa');
    
    // Set up scales
    const xScale = d3.scaleLinear()
        .domain([0, chartData.length - 1])
        .range([margin.left, width - margin.right]);
    
    // Calculate y domain with a bit of padding
    const yMin = d3.min(chartData, d => d.low) * 0.99;
    const yMax = d3.max(chartData, d => d.high) * 1.01;
    
    const yScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([height - margin.bottom, margin.top])
        .nice();
    
    // Draw price line
    const line = d3.line()
        .x((d, i) => xScale(i))
        .y(d => yScale(d.close))
        .curve(d3.curveMonotoneX); // Smoother line
    
    svg.append('path')
        .datum(chartData)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 1.5)
        .attr('d', line);
    
    // Draw trendline
    if (stockData.slope !== undefined && stockData.intercept !== undefined) {
        const trendline = d3.line()
            .x((d, i) => xScale(i))
            .y(i => yScale(stockData.slope * i + stockData.intercept))
            .curve(d3.curveLinear);
        
        svg.append('path')
            .datum(Array.from({ length: chartData.length }, (_, i) => i))
            .attr('fill', 'none')
            .attr('stroke', stockData.direction === 'up' ? '#28a745' : '#dc3545')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '3,3')
            .attr('d', trendline);
        
        // Draw touch points if available
        if (stockData.touchPoints && stockData.touchPoints.length > 0) {
            svg.selectAll('.touch-point')
                .data(stockData.touchPoints)
                .enter()
                .append('circle')
                .attr('cx', d => xScale(d.index))
                .attr('cy', d => yScale(d.value))
                .attr('r', 2)
                .attr('fill', 'orange');
        }
    }
}

function showFullScreenChart(symbol) {
    console.log(`Showing full screen chart for ${symbol}`);
    
    const popupContainer = document.querySelector('.chart-popup');
    const popupChartContainer = document.getElementById('popupChartContainer');
    const popupTitle = document.getElementById('popupChartTitle');
    
    if (!popupContainer || !popupChartContainer) {
        createChartPopup();
        return showFullScreenChart(symbol);
    }
    
    // Clear existing chart
    popupChartContainer.innerHTML = '';
    
    // Set popup title
    if (popupTitle) {
        popupTitle.textContent = `${symbol} Trendline Analysis`;
    }
    
    // Show popup
    popupContainer.style.display = 'flex';
    
    // Ensure close button works by reattaching the event listener
    const closeButton = document.querySelector('.chart-popup-close');
    if (closeButton) {
        // Remove any existing event listeners by cloning and replacing
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        
        // Add event listener to the new button
        newCloseButton.addEventListener('click', () => {
            popupContainer.style.display = 'none';
        });
    }
    
    // Check if we have data for this symbol
    if (!stockHistoricalData[symbol] || stockHistoricalData[symbol].length < 10) {
        const noDataLabel = document.createElement('div');
        noDataLabel.textContent = 'No data available';
        noDataLabel.style.position = 'absolute';
        noDataLabel.style.top = '50%';
        noDataLabel.style.left = '50%';
        noDataLabel.style.transform = 'translate(-50%, -50%)';
        noDataLabel.style.color = '#999';
        noDataLabel.style.fontSize = '16px';
        popupChartContainer.appendChild(noDataLabel);
        return;
    }
    
    // Find trendline data for this stock
    const trendlineData = trendlineStocks.find(s => s.symbol === symbol);
    const currentPrice = currentPrices[symbol] || 0;
    
    // Process data - use more data points for full screen
    const allData = stockHistoricalData[symbol];
    
    // Use the lookback period to determine how much data to show
    const lookbackPeriod = parseInt(document.getElementById('lookbackPeriod').value) || DEFAULT_LOOKBACK_PERIOD;
    const displayData = allData.length > lookbackPeriod * 2 ? allData.slice(-lookbackPeriod * 2) : allData;
    
    // Wait for the popup to be visible
    setTimeout(() => {
        // Set up dimensions
        const width = popupChartContainer.clientWidth || 800;
        const height = popupChartContainer.clientHeight || 400;
        const margin = {top: 40, right: 100, bottom: 50, left: 70};
    
    // Create SVG
        const svg = d3.select(popupChartContainer)
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
            .domain([0, displayData.length - 1])
            .range([margin.left, width - margin.right]);
        
        // Y scale - calculate appropriate min/max
        const minPrice = d3.min(displayData, d => d.low) * 0.99;
        const maxPrice = d3.max(displayData, d => d.high) * 1.01;
        
        const y = d3.scaleLinear()
            .domain([minPrice, maxPrice])
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
                    // If we have enough data points, show fewer labels
                    if (displayData.length > 30 && d % Math.floor(displayData.length / 10) !== 0) {
                        return "";
                    }
                    // If dates are available, use them; otherwise show indices
                    if (displayData[d] && displayData[d].date) {
                        const date = new Date(displayData[d].date);
                return date.toLocaleDateString();
            }
                    return d;
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
            .text(`${symbol} Price History with Trendline`);
    
    // Draw candlesticks
        const candleWidth = Math.min(8, (width - margin.left - margin.right) / displayData.length * 0.8);
        
        // Draw candlesticks - bodies
        svg.selectAll("rect.candle")
            .data(displayData)
            .join("rect")
            .attr("class", "candle")
            .attr("x", (d, i) => x(i) - (candleWidth / 2))
            .attr("y", d => y(Math.max(d.open, d.close)))
            .attr("width", candleWidth)
            .attr("height", d => Math.max(1, Math.abs(y(d.open) - y(d.close))))
            .attr("fill", d => d.open > d.close ? "#ef5350" : "#26a69a")
            .attr("stroke", d => d.open > d.close ? "#c62828" : "#00897b")
            .attr("stroke-width", 0.5);
        
        // Draw wicks (high-low lines)
        svg.selectAll("line.wick")
            .data(displayData)
            .join("line")
            .attr("class", "wick")
            .attr("x1", (d, i) => x(i))
            .attr("x2", (d, i) => x(i))
            .attr("y1", d => y(d.high))
            .attr("y2", d => y(d.low))
            .attr("stroke", d => d.open > d.close ? "#c62828" : "#00897b")
            .attr("stroke-width", 1);
        
        // Draw trendline if available
        if (trendlineData) {
            // Calculate trendline points
            const trendColor = trendlineData.direction === 'up' ? "#4CAF50" : "#F44336";
            const points = [];
            
            // Draw the trendline
            for (let i = 0; i < displayData.length; i++) {
                const trendlineValue = trendlineData.slope * i + trendlineData.intercept;
                points.push({x: i, y: trendlineValue});
            }
            
            // Create line generator
            const line = d3.line()
                .x(d => x(d.x))
                .y(d => y(d.y));
            
            // Draw the trendline
            svg.append("path")
                .datum(points)
                .attr("fill", "none")
                .attr("stroke", trendColor)
                .attr("stroke-width", 2)
                .attr("class", "trendline")
                .attr("d", line);
            
            // Draw touch points on the trendline
            if (trendlineData.touchPoints && trendlineData.touchPoints.length > 0) {
                // Map touch points to chart coordinates
                const touchPointsData = trendlineData.touchPoints.map(point => {
                    // Find the index of this point in our display data
                    const index = displayData.findIndex(d => 
                        d.high === point.high && 
                        d.low === point.low && 
                        d.close === point.close);
                    
                    if (index !== -1) {
                        return {
                            x: index,
                            y: trendlineData.direction === 'up' ? point.low : point.high
                        };
                    }
                    return null;
                }).filter(p => p !== null);
                
                // Draw the touch points
                svg.selectAll("circle.touch-point")
                    .data(touchPointsData)
                    .join("circle")
                    .attr("class", "touch-point")
                    .attr("cx", d => x(d.x))
                    .attr("cy", d => y(d.y))
                    .attr("r", 4)
                    .attr("fill", "orange")
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 1);
            }
            
            // Add trendline information labels
            svg.append("text")
                .attr("x", width - margin.right + 10)
                .attr("y", margin.top + 20)
                .attr("fill", trendColor)
                .attr("font-size", "12px")
                .attr("font-weight", "bold")
                .attr("text-anchor", "start")
                .text(`${trendlineData.direction === 'up' ? 'Uptrend' : 'Downtrend'} Trendline`);
                
            svg.append("text")
                .attr("x", width - margin.right + 10)
                .attr("y", margin.top + 40)
                .attr("fill", "#555")
                .attr("font-size", "12px")
                .attr("text-anchor", "start")
                .text(`Touches: ${trendlineData.touches}`);
                
            svg.append("text")
                .attr("x", width - margin.right + 10)
                .attr("y", margin.top + 60)
                .attr("fill", "#555")
                .attr("font-size", "12px")
                .attr("text-anchor", "start")
                .text(`Quality: ${trendlineData.quality}`);
                
            svg.append("text")
                .attr("x", width - margin.right + 10)
                .attr("y", margin.top + 80)
                .attr("fill", "#555")
                .attr("font-size", "12px")
                .attr("text-anchor", "start")
                .text(`Duration: ${trendlineData.duration} days`);
        }
        
        // Add current price line
        if (currentPrice && !isNaN(currentPrice)) {
            svg.append("line")
                .attr("class", "current-price-line")
                .attr("x1", margin.left)
                .attr("x2", width - margin.right)
                .attr("y1", y(currentPrice))
                .attr("y2", y(currentPrice))
                .attr("stroke", "#FF9800")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "2,2");
            
            // Add current price label
            svg.append("text")
                .attr("class", "price-label")
                .attr("x", width - margin.right + 10)
                .attr("y", y(currentPrice) + 4)
                .attr("fill", "#FF9800")
                .attr("font-size", "12px")
                .attr("font-weight", "bold")
                .attr("text-anchor", "start")
                .text(`Current: ${currentPrice.toFixed(2)}`);
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
            
        if (trendlineData) {
            const trendColor = trendlineData.direction === 'up' ? "#4CAF50" : "#F44336";
            legend.append("line")
                .attr("x1", 240)
                .attr("x2", 280)
                .attr("y1", 6)
                .attr("y2", 6)
                .attr("stroke", trendColor)
                .attr("stroke-width", 2);
                
            legend.append("text")
                .attr("x", 290)
                .attr("y", 10)
                .attr("font-size", "11px")
                .text(trendlineData.direction === 'up' ? "Uptrend" : "Downtrend");
        }
            
    }, 50);
}

function generateTrendQualityChart() {
    if (trendlineStocks.length === 0) return;
    
    const container = document.getElementById('trendQualityChart');
    container.innerHTML = '';
    
    // Count quality categories
    const qualityCounts = {
        strong: trendlineStocks.filter(s => s.quality === 'strong').length,
        medium: trendlineStocks.filter(s => s.quality === 'medium').length,
        weak: trendlineStocks.filter(s => s.quality === 'weak').length
    };
    
    // Create data array for pie chart
    const data = [
        { label: 'Strong', value: qualityCounts.strong, color: '#4caf50' },
        { label: 'Medium', value: qualityCounts.medium, color: '#ff9800' },
        { label: 'Weak', value: qualityCounts.weak, color: '#f44336' }
    ];
    
    // Chart dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;
    const radius = Math.min(width, height) / 2 - 40;
    
    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);
    
    // Create pie chart
    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);
    
    const arc = d3.arc()
        .innerRadius(radius * 0.5)  // Donut chart
        .outerRadius(radius);
    
    // Add slices
    const slices = svg.selectAll('path')
        .data(pie(data))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', d => d.data.color)
        .attr('stroke', 'white')
        .style('stroke-width', '2px');
    
    // Add labels
    svg.selectAll('text')
        .data(pie(data))
        .enter()
        .append('text')
        .attr('transform', d => `translate(${arc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .text(d => d.data.value > 0 ? `${d.data.label}: ${d.data.value}` : '')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', 'white');
    
    // Add title
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -height / 2 + 20)
        .text('Trend Quality Distribution')
        .style('font-size', '16px')
        .style('font-weight', 'bold');
}

function generateTrendDurationChart() {
    if (trendlineStocks.length === 0) return;
    
    const container = document.getElementById('trendDurationChart');
    container.innerHTML = '';
    
    // Group by duration ranges
    const durationRanges = {
        '7-14 days': trendlineStocks.filter(s => s.duration >= 7 && s.duration < 14).length,
        '14-30 days': trendlineStocks.filter(s => s.duration >= 14 && s.duration < 30).length,
        '30-60 days': trendlineStocks.filter(s => s.duration >= 30 && s.duration < 60).length,
        '60+ days': trendlineStocks.filter(s => s.duration >= 60).length
    };
    
    // Create data array for bar chart
    const data = Object.entries(durationRanges).map(([label, value]) => ({ label, value }));
    
    // Chart dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 30, right: 20, bottom: 40, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    // X scale
    const x = d3.scaleBand()
        .domain(data.map(d => d.label))
        .range([0, chartWidth])
        .padding(0.3);
    
    // Y scale
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) || 1])
        .range([chartHeight, 0])
        .nice();
    
    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0, ${chartHeight})`)
        .call(d3.axisBottom(x));
    
    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y).ticks(5));
    
    // Add bars
    svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.label))
        .attr('y', d => y(d.value))
        .attr('width', x.bandwidth())
        .attr('height', d => chartHeight - y(d.value))
        .attr('fill', '#2196f3');
    
    // Add values on top of bars
    svg.selectAll('.bar-value')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'bar-value')
        .attr('x', d => x(d.label) + x.bandwidth() / 2)
        .attr('y', d => y(d.value) - 5)
        .attr('text-anchor', 'middle')
        .text(d => d.value)
        .style('font-size', '12px')
        .style('font-weight', 'bold');
    
    // Add title
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', chartWidth / 2)
        .attr('y', -10)
        .text('Trend Duration Distribution')
        .style('font-size', '16px')
        .style('font-weight', 'bold');
}

function getTrendDirectionIcon(direction) {
    if (direction === 'up') {
        return `<span class="uptrend">▲</span>`;
    } else {
        return `<span class="downtrend">▼</span>`;
    }
}

function getDistanceClass(distance) {
    const absDistance = Math.abs(parseFloat(distance));
    
    if (absDistance < 1) {
        return 'close-trend';
    } else if (absDistance < 2) {
        return 'near-trend';
    }
    
    return '';
}

function showNoStocksMessage() {
    const tableBody = document.getElementById('trendlineTableBody');
    tableBody.innerHTML = `
        <tr>
            <td colspan="10" class="no-stocks-message">
                No stocks match the trendline criteria. Try adjusting the filters.
            </td>
        </tr>
    `;
    
    // Clear counters
    document.getElementById('stockCount').textContent = '0';
    document.getElementById('uptrendCount').textContent = '0';
    document.getElementById('downtrendCount').textContent = '0';
}

function hideChartPopup() {
    document.getElementById('chartPopup').style.display = 'none';
}

function handleWindowResize() {
    // Redraw mini charts if window is resized
    trendlineStocks.forEach(stock => {
        createMiniChart(stock.symbol, stock);
    });
    
    // Redraw breakdown charts if tab is active
    if (document.getElementById('breakdownTab').classList.contains('active')) {
        generateTrendQualityChart();
        generateTrendDurationChart();
    }
}

function saveFilteredStocksToHistory() {
    // Update history with current filtered stocks
    const now = new Date().toISOString();
    
    trendlineStocks.forEach(stock => {
        // Only update if not already in history or if it's older
        if (!trendlineStocksHistory[stock.symbol] ||
            new Date(trendlineStocksHistory[stock.symbol].timestamp) < new Date(now)) {
            
            trendlineStocksHistory[stock.symbol] = {
                timestamp: now,
                direction: stock.direction
            };
        }
    });
    
    // Save to localStorage
    localStorage.setItem('enhancedTrendlineStocksHistory', JSON.stringify(trendlineStocksHistory));
}

function addSelectedToWatchlist() {
    const selectedCheckboxes = document.querySelectorAll('.stock-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
        showError('No stocks selected');
        return;
    }
    
    let addedCount = 0;
    
    selectedCheckboxes.forEach(checkbox => {
        const symbol = checkbox.getAttribute('data-symbol');
        if (!symbol) return;
        
        // Only add if not already in watchlist
        if (!isInWatchlist(symbol)) {
            toggleWatchlist(symbol);
            addedCount++;
        }
        
        // Uncheck the checkbox
        checkbox.checked = false;
    });
    
    // Show feedback
    if (addedCount === 0) {
        showError('Selected stocks are already in your watchlist');
    } else if (addedCount === 1) {
        showSuccess(`Added ${addedCount} stock to your watchlist`);
    } else {
        showSuccess(`Added ${addedCount} stocks to your watchlist`);
    }
    
    // Refresh the display to update any filtering
    if (document.getElementById('showWatchlistOnly').checked) {
        filterTrendlineStocks();
    }
}

function toggleAutoRefresh() {
    isAutoRefreshEnabled = document.getElementById('autoRefreshToggle').checked;
    
    if (isAutoRefreshEnabled) {
        startAutoRefresh();
        showSuccess('Auto-refresh enabled');
    } else {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
        showSuccess('Auto-refresh disabled');
    }
    
    // Save preference
    localStorage.setItem('enhancedTrendlineAutoRefresh', isAutoRefreshEnabled);
}

function startAutoRefresh() {
    // Clear existing interval if any
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Set new interval
    autoRefreshInterval = setInterval(() => {
        console.log('Auto-refreshing stock list...');
        refreshStockList();
    }, AUTO_REFRESH_INTERVAL);
    
    console.log(`Auto-refresh started, interval: ${AUTO_REFRESH_INTERVAL / 60000} minutes`);
}

function setupAutoRefresh() {
    // Check if auto-refresh is enabled in settings
    const savedSettings = localStorage.getItem('enhancedTrendlineScannerSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.autoRefreshEnabled) {
            document.getElementById('autoRefreshToggle').checked = true;
            startAutoRefresh();
        }
    }
}

// Add this function to generate current prices from historical data
function generateCurrentPricesFromHistorical() {
    console.log("Generating current prices from historical data...");
    if (Object.keys(stockHistoricalData).length > 0) {
        Object.keys(stockHistoricalData).forEach(symbol => {
            const data = stockHistoricalData[symbol];
            if (data && data.length > 0) {
                // Use last close price as current price
                currentPrices[symbol] = data[data.length - 1].close;
            }
        });
        console.log(`Generated ${Object.keys(currentPrices).length} prices from historical data`);
        
        // Save to localStorage for other pages to use
        localStorage.setItem('currentPrices', JSON.stringify(currentPrices));
        
        // Refresh the stock list
        filterTrendlineStocks();
    }
}

// Implementation of isInWatchlist to directly check localStorage
function isInWatchlist(symbol) {
    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    return userStocks.some(stock => stock.symbol === symbol && stock.watchlist === true);
}

// Direct implementation of toggleWatchlist to update localStorage
function toggleWatchlist(symbol) {
    console.log("Toggling watchlist for", symbol);
    
    // Direct implementation that doesn't rely on other functions
    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    const stockIndex = userStocks.findIndex(stock => stock.symbol === symbol);
    
    let isWatchlisted = false;
    
    if (stockIndex !== -1) {
        // Toggle the watchlist status
        userStocks[stockIndex].watchlist = !userStocks[stockIndex].watchlist;
        isWatchlisted = userStocks[stockIndex].watchlist;
    } else {
        // Add new stock to watchlist
        const newStock = {
            symbol,
            watchlist: true,
            addedAt: new Date().toISOString(),
            folder: 'all',
            supportPrice1: null,
            supportPrice2: null,
            supportPrice3: null,
            upperLimit: null
        };
        userStocks.push(newStock);
        isWatchlisted = true;
    }
    
    // Save the updated stocks
    localStorage.setItem('userStocks', JSON.stringify(userStocks));
    
    // Update all buttons with this symbol
    document.querySelectorAll(`.watchlist-btn[data-watchlist="${symbol}"]`).forEach(btn => {
        btn.classList.toggle('active', isWatchlisted);
        btn.title = isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist';
        btn.textContent = isWatchlisted ? '★' : '☆';
    });
    
    // Update all rows with this symbol
    document.querySelectorAll(`tr[data-symbol="${symbol}"]`).forEach(row => {
        if (isWatchlisted) {
            row.classList.add('watchlist-item');
        } else {
            row.classList.remove('watchlist-item');
        }
    });
    
    // Show success message
    showSuccess(isWatchlisted ? 
        `${symbol} added to watchlist` : 
        `${symbol} removed from watchlist`);
        
    return isWatchlisted;
}

// Add watchlist styles
function addWatchlistStyles() {
    // Check if the styles are already added
    if (document.getElementById('watchlist-styles')) return;
    
    // Create style element
    const style = document.createElement('style');
    style.id = 'watchlist-styles';
    style.textContent = `
        .watchlist-item {
            background-color: rgba(255, 0, 0, 0.1) !important;
        }
        
        .watchlist-btn {
            background-color: #eee;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 4px 8px;
            margin-right: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        
        .watchlist-btn.active {
            background-color: #ffeb3b;
            color: #333;
            border-color: #ffc107;
        }
        
        .watchlist-btn:hover {
            background-color: #e0e0e0;
        }
        
        .watchlist-btn.active:hover {
            background-color: #ffd740;
        }
    `;
    
    // Add to document head
    document.head.appendChild(style);
} 
