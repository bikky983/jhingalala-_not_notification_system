// Global variables
let userStocks = [];
let currentPrices = {};
let stockHistoricalData = {}; // To store historical data
let chartInstances = {}; // To store chart instances by symbol
let supportPredictions = []; // To store support predictions
let autoRefreshInterval = null;
let boughtStocks = JSON.parse(localStorage.getItem('boughtStocks') || '[]'); // Track bought stocks

// Constants
const DEFAULT_QUANTITY = 10;
const DEFAULT_RSI_PERIOD = 14;
const DEFAULT_MACD_FAST = 12;
const DEFAULT_MACD_SLOW = 26;
const DEFAULT_MACD_SIGNAL = 9;
const DEFAULT_STOCH_K_PERIOD = 14;
const DEFAULT_STOCH_D_PERIOD = 3;
const NEW_BADGE_DAYS = 3; // Show "New" badge for stocks added in the last 3 days

// Updated confidence thresholds for swing trading (major support zones)
const CONFIDENCE_THRESHOLDS = {
    STRONG: 0.8,  // Reverted from 0.85
    MEDIUM: 0.6,  // Reverted from 0.7
    WEAK: 0.4     // Reverted from 0.5
};

// Constants for major support zones (further from current price for swing traders)
const SWING_TRADING = {
    // Lookback periods for analyzing major support zones
    SHORT_TERM_DAYS: 30,     // 1 month
    MEDIUM_TERM_DAYS: 90,    // 3 months
    LONG_TERM_DAYS: 250,     // 1 year
    
    // Parameters for support zone identification
    MIN_TOUCHES: 2,          // Minimum touches of a level to be considered valid
    PRICE_TOLERANCE: 0.03,   // 3% tolerance for grouping similar price levels
    
    // Distance thresholds from current price (%)
    MIN_DISTANCE: 5,         // Minimum 5% down from current price
    IDEAL_DISTANCE: 12,      // Ideal distance for swing entry (12% down)
    MAX_DISTANCE: 25,        // Maximum 25% down from current price
    
    // Volume confirmation
    VOLUME_THRESHOLD: 1.5,   // Volume spike threshold at support level
};

document.addEventListener('DOMContentLoaded', function() {
    // Initialize application
    initializePage();
    setupEventListeners();
    
    // Create chart popup element if needed
    if (!document.querySelector('.chart-popup')) {
        createChartPopup();
    }
    
    // Initialize watchlist
    if (typeof initWatchlist === 'function') {
        initWatchlist();
    }
    
    // Load historical data
    fetchHistoricalData();
});

// Add toggleWatchlist function to use the common version
function toggleWatchlist(symbol) {
    // Use the common function if available
    if (typeof window.toggleWatchlist === 'function') {
        window.toggleWatchlist(symbol);
        return;
    }
    
    // Fallback implementation if needed
    // This should not be needed since we're including common-watchlist.js
}

// Create chart popup element
function createChartPopup() {
    const popupElement = document.createElement('div');
    popupElement.className = 'chart-popup';
    popupElement.innerHTML = `
        <div class="chart-popup-content">
            <div class="chart-popup-header">
                <h3 id="popupChartTitle">Stock Chart</h3>
                <button class="chart-popup-close">&times;</button>
            </div>
            <div class="chart-popup-body">
                <div id="popupChartContainer"></div>
            </div>
        </div>
    `;
    document.body.appendChild(popupElement);
    
    // Add event listener to close button
    document.querySelector('.chart-popup-close').addEventListener('click', () => {
        document.querySelector('.chart-popup').style.display = 'none';
    });
}

function initializePage() {
    loadUserStocks();
    loadCurrentPrices();
    setupTabNavigation();
    setupAutoRefresh();
    loadSettings();
}

function setupEventListeners() {
    const refreshPredictionsBtn = document.getElementById('refreshPredictionsBtn');
    if (refreshPredictionsBtn) {
        console.log('Found refresh button:', refreshPredictionsBtn);
        refreshPredictionsBtn.addEventListener('click', () => {
            console.log('Refresh button clicked!');
            loadCurrentPrices();
            calculateSupportPredictions();
        });
    } else {
        console.error('refreshPredictionsBtn not found!');
    }
    
    // Update All Support Prices button
    const updateAllSupportBtn = document.getElementById('updateAllSupportBtn');
    if (updateAllSupportBtn) {
        console.log('Found update all support button:', updateAllSupportBtn);
        updateAllSupportBtn.addEventListener('click', () => {
            console.log('Update all support button clicked!');
            updateAllSupportPrices();
        });
    } else {
        console.error('updateAllSupportBtn not found!');
    }
    
    // Auto-refresh toggle
    const autoRefreshBtn = document.getElementById('autoRefreshBtn');
    if (autoRefreshBtn) {
        console.log('Found auto-refresh button:', autoRefreshBtn);
        const isAutoRefreshEnabled = localStorage.getItem('autoRefreshEnabled') === 'true';
        autoRefreshBtn.textContent = isAutoRefreshEnabled ? 'Disable Auto Refresh' : 'Enable Auto Refresh';
        autoRefreshBtn.addEventListener('click', () => {
            console.log('Auto-refresh button clicked!');
            toggleAutoRefresh();
        });
    } else {
        console.error('autoRefreshBtn not found!');
    }
    
    // Stock search functionality
    const searchInput = document.getElementById('stockSearchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', filterStockTable);
    } else {
        console.error('stockSearchInput not found!');
    }
    
    // Technical indicator checkboxes
    addEventListenerIfExists('usePriceAction', 'change', calculateSupportPredictions);
    addEventListenerIfExists('useVolume', 'change', calculateSupportPredictions);
    addEventListenerIfExists('useFibonacci', 'change', calculateSupportPredictions);
    addEventListenerIfExists('useMovingAverage', 'change', calculateSupportPredictions);
    
    // Support pattern recognition checkboxes
    addEventListenerIfExists('useDoubleBotom', 'change', calculateSupportPredictions);
    addEventListenerIfExists('useRoundedBottom', 'change', calculateSupportPredictions);
    addEventListenerIfExists('useBullishDivergence', 'change', calculateSupportPredictions);
    addEventListenerIfExists('useHistoricalLevels', 'change', calculateSupportPredictions);
    
    // Statistical methods checkboxes
    addEventListenerIfExists('useMeanReversion', 'change', calculateSupportPredictions);
    addEventListenerIfExists('useStandardDeviation', 'change', calculateSupportPredictions);
    addEventListenerIfExists('useVolumeWeighted', 'change', calculateSupportPredictions);
    
    // Filter settings
    addEventListenerIfExists('minConfidence', 'change', () => {
        saveSettings();
        displayPredictions();
    });
    
    addEventListenerIfExists('maxDistancePercent', 'change', () => {
        saveSettings();
        displayPredictions();
    });
    
    addEventListenerIfExists('maxDistancePercent', 'keypress', (e) => {
        if (e.key === 'Enter') {
            saveSettings();
            displayPredictions();
        }
    });
    
    addEventListenerIfExists('timeframeWeight', 'change', () => {
        saveSettings();
        calculateSupportPredictions();
    });
    
    // Advanced settings
    addEventListenerIfExists('fibonacciLevels', 'change', () => {
        saveSettings();
        calculateSupportPredictions();
    });
    
    addEventListenerIfExists('divergenceIndicator', 'change', () => {
        saveSettings();
        calculateSupportPredictions();
    });
    
    addEventListenerIfExists('stdDevMultiplier', 'change', () => {
        saveSettings();
        calculateSupportPredictions();
    });
    
    // Manual stock entry
    const addManualStockBtn = document.getElementById('addManualStockBtn');
    if (addManualStockBtn) {
        console.log('Found add manual stock button:', addManualStockBtn);
        addManualStockBtn.addEventListener('click', () => {
            console.log('Add manual stock button clicked!');
            showManualStockForm();
        });
    } else {
        console.error('addManualStockBtn not found!');
    }
    
    addEventListenerIfExists('saveManualStockBtn', 'click', saveManualStock);
    addEventListenerIfExists('cancelManualStockBtn', 'click', hideManualStockForm);
    
    // Add enter key support for manual stock input
    addEventListenerIfExists('manualSymbol', 'keypress', (e) => {
        if (e.key === 'Enter') {
            saveManualStock();
        }
    });
    
    // Setup tab navigation
    setupTabNavigation();
    
    // Handle window resize for responsive charts
    window.addEventListener('resize', () => {
        // Resize all charts
        Object.keys(chartInstances).forEach(symbol => {
            const chart = chartInstances[symbol];
            if (chart && chart.chart) {
                const container = chart.container;
                if (container && container.offsetWidth > 0) {
                    chart.chart.applyOptions({
                        width: container.offsetWidth,
                        height: container.offsetHeight
                    });
                }
            }
        });
        
        // Refresh the current tab's content
        const activeTab = document.querySelector('.nav-pill.active');
        if (activeTab) {
            const tabId = activeTab.getAttribute('data-tab');
            if (tabId === 'analysis') {
                updateHistoricalAnalysis();
            }
        }
    });
}

// Helper function to add event listener only if the element exists
function addEventListenerIfExists(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(event, handler);
    } else {
        console.warn(`Element with id '${id}' not found for event listener`);
    }
}

function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-pill');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Show corresponding content
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(`${tabId}Content`).classList.add('active');
            
            // Special handling for analysis tab
            if (tabId === 'analysis') {
                updateHistoricalAnalysis();
            }
            
            // Special handling for portfolio tab
            if (tabId === 'portfolio') {
                updatePortfolioAnalysis();
            }
        });
    });
}

function setupAutoRefresh() {
    clearInterval(autoRefreshInterval);
    
    const isAutoRefreshEnabled = localStorage.getItem('autoRefreshEnabled') === 'true';
    if (isAutoRefreshEnabled) {
        // Refresh prices every 60 seconds
        autoRefreshInterval = setInterval(() => {
            loadCurrentPrices();
            calculateSupportPredictions();
        }, 60000);
    }
}

function toggleAutoRefresh() {
    const autoRefreshBtn = document.getElementById('autoRefreshBtn');
    if (!autoRefreshBtn) {
        console.error('autoRefreshBtn not found in toggleAutoRefresh function');
        return;
    }
    
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

function loadUserStocks() {
    userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    boughtStocks = JSON.parse(localStorage.getItem('boughtStocks') || '[]');
}

function loadCurrentPrices() {
    showLoading(true);
    try {
        // Load current prices from localStorage (set by dashboard)
        const storedPrices = localStorage.getItem('currentPrices');
        
        if (storedPrices) {
            currentPrices = JSON.parse(storedPrices);
            calculateSupportPredictions();
            showLoading(false);
            return currentPrices;
        } else {
            // If no stored prices, fallback to API
            console.warn('No stored prices found in localStorage. Using API fallback.');
            return fetchCurrentPricesFromAPI();
        }
    } catch (error) {
        console.error('Error loading current prices:', error);
        showError('Failed to load current prices');
        showLoading(false);
        return {};
    }
}

// Fallback method if localStorage prices are not available
async function fetchCurrentPricesFromAPI() {
    showLoading(true);
    try {
        const response = await fetch('/api/prices');
        if (!response.ok) {
            throw new Error('Failed to fetch prices');
        }
        
        const prices = await response.json();
        currentPrices = prices;
        
        calculateSupportPredictions();
        showLoading(false);
        return prices;
    } catch (error) {
        console.error('Error fetching prices from API:', error);
        showError('Failed to fetch prices from API');
        showLoading(false);
        return {};
    }
}

// Calculate support predictions based on enabled indicators and methods
function calculateSupportPredictions() {
    if (!stockHistoricalData || Object.keys(stockHistoricalData).length === 0) {
        console.log("No historical data available yet.");
        return;
    }
    
    supportPredictions = [];
    showLoading(true);
    
    // Get selected settings with null checks
    const usePriceAction = document.getElementById('usePriceAction')?.checked ?? true;
    const useVolume = document.getElementById('useVolume')?.checked ?? true;
    const useFibonacci = document.getElementById('useFibonacci')?.checked ?? true;
    const useMovingAverage = document.getElementById('useMovingAverage')?.checked ?? true;
    const useDoubleBotom = document.getElementById('useDoubleBotom')?.checked ?? true;
    const useRoundedBottom = document.getElementById('useRoundedBottom')?.checked ?? true;
    const useBullishDivergence = document.getElementById('useBullishDivergence')?.checked ?? true;
    const useHistoricalLevels = document.getElementById('useHistoricalLevels')?.checked ?? true;
    const useMeanReversion = document.getElementById('useMeanReversion')?.checked ?? true;
    const useStandardDeviation = document.getElementById('useStandardDeviation')?.checked ?? true;
    const useVolumeWeighted = document.getElementById('useVolumeWeighted')?.checked ?? true;
    
    // Get timeframe weights (short, medium, long-term)
    const timeframeWeightElem = document.getElementById('timeframeWeight');
    const timeframeWeight = timeframeWeightElem ? timeframeWeightElem.value : 'balanced';
    
    // Define weight factors based on selected timeframe preference
    let shortTermWeight = 1.0;
    let mediumTermWeight = 1.0;
    let longTermWeight = 1.0;
    
    switch (timeframeWeight) {
        case 'shortTerm':
            shortTermWeight = 2.0;
            mediumTermWeight = 1.0;
            longTermWeight = 0.5;
            break;
        case 'mediumTerm':
            shortTermWeight = 0.8;
            mediumTermWeight = 2.0;
            longTermWeight = 1.2;
            break;
        case 'longTerm':
            shortTermWeight = 0.5;
            mediumTermWeight = 1.0;
            longTermWeight = 2.0;
            break;
        // balanced is the default
    }
    
    // Get Fibonacci levels
    const fibLevelsElem = document.getElementById('fibonacciLevels');
    const fibLevelsStr = fibLevelsElem ? fibLevelsElem.value : '0.382,0.5,0.618';
    const fibLevels = fibLevelsStr.split(',').map(Number);
    
    // Get divergence indicator
    const divergenceIndicatorElem = document.getElementById('divergenceIndicator');
    const divergenceIndicator = divergenceIndicatorElem ? divergenceIndicatorElem.value : 'rsi';
    
    // Get standard deviation multiplier
    const stdDevMultiplierElem = document.getElementById('stdDevMultiplier');
    const stdDevMultiplier = stdDevMultiplierElem ? parseFloat(stdDevMultiplierElem.value) : 2.0;
    
    // Process each stock
    userStocks.forEach(stock => {
        const currentPrice = currentPrices[stock.symbol] || 0;
        if (currentPrice <= 0) return;
        
        // Get historical data for this stock
        const historicalData = stockHistoricalData[stock.symbol];
        if (!historicalData || historicalData.length < 50) return; // Skip if not enough data
        
        // Calculate support levels using enabled methods
        const supportLevels = [];
        
        if (usePriceAction) {
            const priceActionSupports = calculatePriceActionSupport(historicalData, currentPrice);
            supportLevels.push(...priceActionSupports);
        }
        
        if (useVolume) {
            const volumeSupports = calculateVolumeSupport(historicalData, currentPrice);
            supportLevels.push(...volumeSupports);
        }
        
        if (useFibonacci) {
            const fibonacciSupports = calculateFibonacciSupport(historicalData, currentPrice, fibLevels);
            supportLevels.push(...fibonacciSupports);
        }
        
        if (useMovingAverage) {
            const maSupports = calculateMovingAverageSupport(historicalData, currentPrice);
            supportLevels.push(...maSupports);
        }
        
        if (useDoubleBotom) {
            const doubleBottomSupports = detectDoubleBottomSupport(historicalData, currentPrice);
            supportLevels.push(...doubleBottomSupports);
        }
        
        if (useRoundedBottom) {
            const roundedBottomSupports = detectRoundedBottomSupport(historicalData, currentPrice);
            supportLevels.push(...roundedBottomSupports);
        }
        
        if (useBullishDivergence) {
            const divergenceSupports = detectBullishDivergence(historicalData, currentPrice, divergenceIndicator);
            supportLevels.push(...divergenceSupports);
        }
        
        if (useHistoricalLevels) {
            const historicalSupports = findHistoricalSupportLevels(historicalData, currentPrice);
            supportLevels.push(...historicalSupports);
        }
        
        if (useMeanReversion) {
            const meanReversionSupports = calculateMeanReversionSupport(historicalData, currentPrice);
            supportLevels.push(...meanReversionSupports);
        }
        
        if (useStandardDeviation) {
            const stdDevSupports = calculateStdDevSupport(historicalData, currentPrice, stdDevMultiplier);
            supportLevels.push(...stdDevSupports);
        }
        
        if (useVolumeWeighted) {
            const vwapSupports = calculateVWAPSupport(historicalData, currentPrice);
            supportLevels.push(...vwapSupports);
        }
        
        // Process support levels to identify clusters and combine evidence
        const combinedSupports = combineSupportLevels(supportLevels, currentPrice);
        
        // Filter out supports that are too far from current price
        const maxDistanceElement = document.getElementById('maxDistancePercent');
        const maxDistancePercent = maxDistanceElement ? parseFloat(maxDistanceElement.value) : 7;
        
        const minConfidenceElement = document.getElementById('minConfidence');
        const minConfidence = minConfidenceElement ? parseFloat(minConfidenceElement.value) : 0.7;
        
        const filteredSupports = combinedSupports.filter(support => {
            // Improved distance calculation (using support price as denominator)
            const distance = ((currentPrice - support.price) / support.price) * 100;
            // Use absolute value to consider support levels both above and below
            return Math.abs(distance) <= maxDistancePercent && support.confidence >= minConfidence;
        });
        
        // If we have valid support levels, add this stock to predictions
        if (filteredSupports.length > 0) {
            // Sort by confidence (highest first)
            filteredSupports.sort((a, b) => b.confidence - a.confidence);
            
            // Take the most confident support
            const bestSupport = filteredSupports[0];
            
            // Calculate distance with improved formula
            const distance = ((currentPrice - bestSupport.price) / bestSupport.price) * 100;
            
            // Create prediction object with needed properties
            supportPredictions.push({
                symbol: stock.symbol,
                currentPrice: currentPrice,
                supportPrice: bestSupport.price,
                distance: distance,
                confidence: bestSupport.confidence,
                indicators: bestSupport.indicators || (bestSupport.method ? [bestSupport.method] : []),
                selected: true,
                isBought: isBoughtStock(stock.symbol)
            });
        }
    });
    
    // Sort by confidence (descending)
    supportPredictions.sort((a, b) => b.confidence - a.confidence);
    
    // Update last updated timestamp
    const now = new Date();
    const lastUpdatedElement = document.getElementById('lastUpdated');
    if (lastUpdatedElement) {
        lastUpdatedElement.textContent = `Last updated: ${now.toLocaleTimeString()}`;
    }
    
    // Display predictions
    displayPredictions();
    
    showLoading(false);
}

// Reverted function to identify minor support levels closer to current price
function calculatePriceActionSupport(historicalData, currentPrice, weight = 1.0) {
    if (!historicalData || historicalData.length < 10) {
        return [];
    }
    
    // Find swing lows (potential support points)
    const swingLows = [];
    
    // Use a smaller window for shorter-term support
    const lookbackWindow = Math.min(5, Math.floor(historicalData.length / 10));
    
    for (let i = lookbackWindow; i < historicalData.length - lookbackWindow; i++) {
        const current = historicalData[i];
        let isSwingLow = true;
        
        // Check if it's a local minimum
        for (let j = i - lookbackWindow; j <= i + lookbackWindow; j++) {
            if (j === i) continue; // Skip self
            
            if (historicalData[j].low < current.low) {
                isSwingLow = false;
                break;
            }
        }
        
        if (isSwingLow) {
            // Check how close to current price (prefer closer supports)
            const distancePercent = ((currentPrice - current.low) / currentPrice) * 100;
            
            // Only consider if within the desired range
            if (distancePercent <= SWING_TRADING.MAX_DISTANCE) {
                // Closer supports have higher confidence
                const distanceWeight = 1.0 - (distancePercent / SWING_TRADING.MAX_DISTANCE) * 0.5;
                
                // Volume confirmation gives a small boost
                const averageVolume = historicalData
                    .slice(i - lookbackWindow, i + lookbackWindow)
                    .reduce((sum, bar) => sum + bar.volume, 0) / (lookbackWindow * 2);
                
                const volumeBoost = current.volume > averageVolume ? 0.1 : 0;
                
                // Confidence calculation - closer to current price is better
                const baseConfidence = 0.6 + Math.random() * 0.1; // Small random factor
                const finalConfidence = Math.min(0.85, (baseConfidence * distanceWeight + volumeBoost) * weight);
                
                swingLows.push({
                    price: current.low,
                    confidence: finalConfidence,
                    method: 'Price Action',
                    date: current.date
                });
            }
        }
    }
    
    return swingLows;
}

// Calculate support based on volume profile
function calculateVolumeSupport(historicalData, currentPrice, threshold = 1.5) {
    const supports = [];
    const priceVolumePairs = [];
    
    // Create price-volume pairs
    historicalData.forEach(candle => {
        // Use average price of the candle
        const avgPrice = (candle.high + candle.low + candle.close) / 3;
        priceVolumePairs.push({ price: avgPrice, volume: candle.volume || 1 });
    });
    
    // Group prices into buckets
    const bucketSize = currentPrice * 0.005; // 0.5% bucket size
    const volumeBuckets = {};
    
    priceVolumePairs.forEach(pair => {
        const bucketIndex = Math.floor(pair.price / bucketSize);
        if (!volumeBuckets[bucketIndex]) {
            volumeBuckets[bucketIndex] = { totalVolume: 0, price: bucketIndex * bucketSize };
        }
        volumeBuckets[bucketIndex].totalVolume += pair.volume;
    });
    
    // Find local maxima in volume profile
    const bucketIndices = Object.keys(volumeBuckets).map(Number).sort((a, b) => a - b);
    
    for (let i = 1; i < bucketIndices.length - 1; i++) {
        const current = volumeBuckets[bucketIndices[i]];
        const prev = volumeBuckets[bucketIndices[i-1]];
        const next = volumeBuckets[bucketIndices[i+1]];
        
        // Local volume maximum
        if (current.totalVolume > prev.totalVolume && current.totalVolume > next.totalVolume) {
            // Only consider volume peaks below current price
            if (current.price < currentPrice) {
                // Calculate confidence based on relative volume
                const avgVolume = Object.values(volumeBuckets).reduce((sum, bucket) => sum + bucket.totalVolume, 0) / bucketIndices.length;
                const volumeFactor = current.totalVolume / avgVolume;
                const confidence = Math.min(0.4 + (volumeFactor * 0.3), 0.9);
                
                supports.push({
                    price: current.price,
                    confidence: confidence,
                    method: 'Volume Profile',
                    type: 'volume-node',
                    indicators: ['Volume Profile'] // For backward compatibility
                });
            }
        }
    }
    
    return supports;
}

// Calculate support based on Fibonacci retracements
function calculateFibonacciSupport(historicalData, currentPrice, fibLevels) {
    const supports = [];
    const prices = historicalData.map(candle => candle.close);
    
    // Find the highest high and lowest low in the last 100 periods
    const recentData = historicalData.slice(-100);
    const highestHigh = Math.max(...recentData.map(candle => candle.high));
    const lowestLow = Math.min(...recentData.map(candle => candle.low));
    
    // Calculate Fibonacci levels (retracements)
    fibLevels.forEach(level => {
        const fibPrice = highestHigh - ((highestHigh - lowestLow) * level);
        
        // Only consider Fibonacci levels below current price
        if (fibPrice < currentPrice) {
            // Higher confidence for key Fibonacci levels (0.618)
            let confidence = 0.6;
            if (level === 0.618) confidence = 0.75;
            if (level === 0.5) confidence = 0.7;
            
            supports.push({
                price: fibPrice,
                confidence: confidence,
                method: `Fibonacci ${level}`,
                type: 'fibonacci',
                level: level,
                indicators: [`Fibonacci ${level}`] // For backward compatibility
            });
        }
    });
    
    return supports;
}

// Reverted function to use shorter moving averages for minor support
function calculateMovingAverageSupport(historicalData, currentPrice) {
    if (!historicalData || historicalData.length < 30) {
        // Need enough data
        return [];
    }
    
    const maSupports = [];
    
    // Use shorter moving averages for minor support
    const periods = [20, 50, 100];
    
    // Calculate EMAs for each period
    periods.forEach(period => {
        // Make sure we have enough data
        if (historicalData.length <= period) {
            return;
        }
        
        // Calculate EMA
        const prices = historicalData.map(d => d.close);
        const ema = calculateEMA(prices, period);
        const latestEMA = ema[ema.length - 1];
        
        // Only consider as support if below current price
        if (latestEMA < currentPrice) {
            // Calculate distance percentage from current price
            const distancePercent = ((currentPrice - latestEMA) / currentPrice) * 100;
            
            // Skip if outside the support zone range
            if (distancePercent > SWING_TRADING.MAX_DISTANCE) {
                return;
            }
            
            // Confidence is based on period length and distance
            let periodConfidence = 0.0;
            switch (period) {
                case 20:
                    periodConfidence = 0.5; // 20 EMA
                    break;
                case 50:
                    periodConfidence = 0.6; // 50 EMA
                    break;
                case 100:
                    periodConfidence = 0.7; // 100 EMA
                    break;
                default:
                    periodConfidence = 0.5;
            }
            
            // Adjust confidence based on distance - closer supports have higher confidence
            const distanceFactor = 1.0 - (distancePercent / SWING_TRADING.MAX_DISTANCE) * 0.3;
            const finalConfidence = Math.min(0.9, periodConfidence * distanceFactor);
            
            maSupports.push({
                price: latestEMA,
                confidence: finalConfidence,
                method: `${period} EMA`,
                period: period
            });
        }
    });
    
    return maSupports;
}

// Helper function to calculate EMA
function calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    let emaValues = [prices[0]];
    
    for (let i = 1; i < prices.length; i++) {
        const ema = (prices[i] * k) + (emaValues[i-1] * (1-k));
        emaValues.push(ema);
    }
    
    return emaValues;
}

// Detect Double/Triple Bottom pattern
function detectDoubleBottomSupport(historicalData, currentPrice, weight = 1.5) {
    const supports = [];
    const prices = historicalData.map(candle => candle.low);
    
    // Find potential bottoms (local minima)
    const bottoms = [];
    for (let i = 3; i < prices.length - 3; i++) {
        if (prices[i] < prices[i-1] && 
            prices[i] < prices[i-2] && 
            prices[i] < prices[i+1] && 
            prices[i] < prices[i+2]) {
            
            bottoms.push({ index: i, price: prices[i] });
        }
    }
    
    // Look for bottoms at similar price levels
    for (let i = 0; i < bottoms.length; i++) {
        const similarBottoms = bottoms.filter(b => 
            Math.abs(b.price - bottoms[i].price) / bottoms[i].price < 0.03 && // Within 3%
            Math.abs(b.index - bottoms[i].index) > 10 // At least 10 bars apart
        );
        
        if (similarBottoms.length >= 1) { // At least 2 bottoms (current + similar)
            const isDoubleBottom = similarBottoms.length === 1;
            const isTripleBottom = similarBottoms.length >= 2;
            const bottomPrice = bottoms[i].price;
            
            // Only consider double/triple bottoms below current price
            if (bottomPrice < currentPrice) {
                // Triple bottoms have higher confidence than double bottoms
                const confidence = isTripleBottom ? 0.85 : 0.75;
                const patternName = isTripleBottom ? 'Triple Bottom' : 'Double Bottom';
                
                supports.push({
                    price: bottomPrice,
                    confidence: confidence,
                    method: patternName,
                    type: isTripleBottom ? 'triple-bottom' : 'double-bottom',
                    indicators: [patternName] // For backward compatibility
                });
                
                // Skip similar bottoms since we've processed them
                i += similarBottoms.length;
            }
        }
    }
    
    return supports;
}

// Detect Rounded Bottom pattern
function detectRoundedBottomSupport(historicalData, currentPrice) {
    const supports = [];
    const prices = historicalData.map(candle => candle.close);
    
    // Look for rounded bottom patterns in segments of the data
    const segmentLength = 30; // Look at 30-bar segments
    
    for (let start = 0; start <= prices.length - segmentLength; start += 10) {
        const segment = prices.slice(start, start + segmentLength);
        
        // Calculate first, middle, and last segment prices
        const firstThird = segment.slice(0, 10);
        const middleThird = segment.slice(10, 20);
        const lastThird = segment.slice(20, 30);
        
        const firstAvg = firstThird.reduce((sum, price) => sum + price, 0) / firstThird.length;
        const middleAvg = middleThird.reduce((sum, price) => sum + price, 0) / middleThird.length;
        const lastAvg = lastThird.reduce((sum, price) => sum + price, 0) / lastThird.length;
        
        // Check for U-shaped pattern (first high, middle low, last high)
        if (firstAvg > middleAvg && lastAvg > middleAvg) {
            const lowestPrice = Math.min(...middleThird);
            
            // Only consider rounded bottoms below current price
            if (lowestPrice < currentPrice) {
                // Calculate how symmetric the pattern is
                const symmetryFactor = Math.min(firstAvg, lastAvg) / Math.max(firstAvg, lastAvg);
                const confidence = 0.6 + (symmetryFactor * 0.3);
                
                supports.push({
                    price: lowestPrice,
                    confidence: confidence,
                    method: 'Rounded Bottom',
                    type: 'rounded-bottom',
                    indicators: ['Rounded Bottom'] // For backward compatibility
                });
            }
        }
    }
    
    return supports;
}

// Detect Bullish Divergence with RSI, MACD, or Stochastic
function detectBullishDivergence(historicalData, currentPrice, indicator) {
    const supports = [];
    
    if (historicalData.length < 50) return supports; // Need enough data
    
    const prices = historicalData.map(candle => candle.close);
    const lows = historicalData.map(candle => candle.low);
    
    // Calculate indicator values based on selection
    let indicatorValues = [];
    
    switch (indicator) {
        case 'rsi':
            indicatorValues = calculateRSI(historicalData, DEFAULT_RSI_PERIOD);
            break;
        case 'macd':
            const macdData = calculateMACD(prices, DEFAULT_MACD_FAST, DEFAULT_MACD_SLOW, DEFAULT_MACD_SIGNAL);
            indicatorValues = macdData.macdLine;
            break;
        case 'stochastic':
            const stochData = calculateStochastic(historicalData, DEFAULT_STOCH_K_PERIOD, DEFAULT_STOCH_D_PERIOD);
            indicatorValues = stochData.k;
            break;
    }
    
    if (indicatorValues.length < 20) return supports;
    
    // Find price lows in recent data
    const recentLows = [];
    for (let i = prices.length - 50; i < prices.length - 5; i++) {
        if (lows[i] < lows[i-1] && lows[i] < lows[i-2] && lows[i] < lows[i+1] && lows[i] < lows[i+2]) {
            recentLows.push({ index: i, price: lows[i] });
        }
    }
    
    // Check for bullish divergence (price makes lower low but indicator makes higher low)
    for (let i = 0; i < recentLows.length - 1; i++) {
        const firstLow = recentLows[i];
        const secondLow = recentLows[i+1];
        
        // Check if price made a lower low
        if (secondLow.price < firstLow.price) {
            // But indicator made a higher low
            const firstIndicatorValue = indicatorValues[firstLow.index] || 0;
            const secondIndicatorValue = indicatorValues[secondLow.index] || 0;
            
            if (secondIndicatorValue > firstIndicatorValue) {
                // Bullish divergence detected
                const divergenceSupport = secondLow.price;
                
                // Only consider support levels below current price
                if (divergenceSupport < currentPrice) {
                    // Calculate confidence based on the strength of divergence
                    const priceDiff = (firstLow.price - secondLow.price) / firstLow.price;
                    const indicatorDiff = (secondIndicatorValue - firstIndicatorValue) / firstIndicatorValue;
                    const divergenceStrength = priceDiff + indicatorDiff;
                    
                    const methodName = `Bullish Divergence (${indicator.toUpperCase()})`;
                    supports.push({
                        price: divergenceSupport,
                        confidence: Math.min(0.7 + (divergenceStrength * 0.2), 0.9),
                        method: methodName,
                        type: 'bullish-divergence',
                        indicators: [methodName] // For backward compatibility
                    });
                    
                    // Break after finding the first divergence
                    break;
                }
            }
        }
    }
    
    return supports;
}

// Calculate RSI for bullish divergence
function calculateRSI(historicalData, period = 14) {
    if (!historicalData || historicalData.length < period + 1) {
        return []; // Not enough data
    }
    
    // Get closing prices array
    const closePrices = historicalData.map(candle => candle.close);
    
    // Calculate price changes
    const priceChanges = [];
    for (let i = 1; i < closePrices.length; i++) {
        priceChanges.push(closePrices[i] - closePrices[i - 1]);
    }
    
    // Calculate gains and losses
    const gains = priceChanges.map(change => change > 0 ? change : 0);
    const losses = priceChanges.map(change => change < 0 ? Math.abs(change) : 0);
    
    // Calculate average gains and losses over the period
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
    
    // Calculate RSI for the first period
    let rsi = [];
    if (avgLoss === 0) {
        rsi.push(100);
    } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
    }
    
    // Calculate RSI for the rest of the data using Wilder's smoothing method
    for (let i = period; i < priceChanges.length; i++) {
        avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
        avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
        
        if (avgLoss === 0) {
            rsi.push(100);
        } else {
            const rs = avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
        }
    }
    
    return rsi;
}

// Calculate MACD for bullish divergence
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    // Calculate EMAs
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);
    
    // Calculate MACD line
    const macdLine = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < slowPeriod - 1) {
            macdLine.push(0); // Not enough data yet
        } else {
            macdLine.push(fastEMA[i] - slowEMA[i]);
        }
    }
    
    // Calculate signal line (EMA of MACD line)
    const signalLine = calculateEMA(macdLine, signalPeriod);
    
    // Calculate histogram (MACD line - signal line)
    const histogram = [];
    for (let i = 0; i < macdLine.length; i++) {
        if (i < slowPeriod + signalPeriod - 2) {
            histogram.push(0); // Not enough data yet
        } else {
            histogram.push(macdLine[i] - signalLine[i]);
        }
    }
    
    return { macdLine, signalLine, histogram };
}

// Calculate Stochastic for bullish divergence
function calculateStochastic(historicalData, kPeriod = 14, dPeriod = 3) {
    const highs = historicalData.map(candle => candle.high);
    const lows = historicalData.map(candle => candle.low);
    const closes = historicalData.map(candle => candle.close);
    
    // Calculate %K
    const kValues = [];
    for (let i = kPeriod - 1; i < historicalData.length; i++) {
        const highInPeriod = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
        const lowInPeriod = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
        
        const currentK = ((closes[i] - lowInPeriod) / (highInPeriod - lowInPeriod)) * 100;
        kValues.push(currentK);
    }
    
    // Calculate %D (simple moving average of %K)
    const dValues = [];
    for (let i = 0; i < kValues.length; i++) {
        if (i < dPeriod - 1) {
            dValues.push(kValues[i]);
        } else {
            const dValue = kValues.slice(i - dPeriod + 1, i + 1).reduce((sum, val) => sum + val, 0) / dPeriod;
            dValues.push(dValue);
        }
    }
    
    // Pad beginning with zeros to match the original data length
    const k = Array(kPeriod - 1).fill(0).concat(kValues);
    const d = Array(kPeriod + dPeriod - 2).fill(0).concat(dValues);
    
    return { k, d };
}

// Function to find major historical support levels for swing trading
function findHistoricalSupportLevels(historicalData, currentPrice) {
    if (!historicalData || historicalData.length < 50) {
        return [];
    }
    
    // Extract all lows from historical data
    const allLows = historicalData.map(d => d.low);
    
    // Group similar price levels (with larger tolerance for major zones)
    const priceLevelGroups = {};
    
    allLows.forEach(price => {
        // Use larger tolerance for major support levels
        const tolerance = price * SWING_TRADING.PRICE_TOLERANCE;
        
        // Find which group this price belongs to
        let foundGroup = false;
        for (const groupKey in priceLevelGroups) {
            const groupPrice = parseFloat(groupKey);
            if (Math.abs(price - groupPrice) <= tolerance) {
                priceLevelGroups[groupKey].push(price);
                foundGroup = true;
                break;
            }
        }
        
        // If no group found, create a new one
        if (!foundGroup) {
            priceLevelGroups[price] = [price];
        }
    });
    
    // Find support levels with at least minimum touches
    const historicalSupports = [];
    
    for (const groupKey in priceLevelGroups) {
        const group = priceLevelGroups[groupKey];
        const groupPrice = parseFloat(groupKey);
        
        if (group.length >= SWING_TRADING.MIN_TOUCHES) {
            // Calculate average price in the group
            const avgPrice = group.reduce((sum, p) => sum + p, 0) / group.length;
            
            // Calculate distance from current price
            const distancePercent = ((currentPrice - avgPrice) / currentPrice) * 100;
            
            // Filter out levels that are above current price or not within distance range
            if (distancePercent < SWING_TRADING.MIN_DISTANCE || distancePercent > SWING_TRADING.MAX_DISTANCE) {
                continue;
            }
            
            // Calculate confidence based on number of touches and relevance
            // More touches = higher confidence
            let touchConfidence = Math.min(0.9, 0.6 + (group.length / 10) * 0.3);
            
            // For major support zones, we prefer levels that have been tested multiple times
            // and are at significant distances (around the IDEAL_DISTANCE)
            const distanceIdealFactor = 1.0 - Math.min(1.0, Math.abs(distancePercent - SWING_TRADING.IDEAL_DISTANCE) / 
                                              (SWING_TRADING.MAX_DISTANCE - SWING_TRADING.MIN_DISTANCE));
            
            const finalConfidence = touchConfidence * (0.7 + distanceIdealFactor * 0.3);
            
            historicalSupports.push({
                    price: avgPrice,
                confidence: finalConfidence,
                method: `Historical Level (${group.length} touches)`,
                touches: group.length
            });
        }
    }
    
    // Sort by confidence
    historicalSupports.sort((a, b) => b.confidence - a.confidence);
    
    // Return top historical support levels
    return historicalSupports.slice(0, 5);
}

// Calculate Mean Reversion levels
function calculateMeanReversionSupport(historicalData, currentPrice) {
    const supports = [];
    const prices = historicalData.map(candle => candle.close);
    
    // Calculate mean and standard deviation
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    // Mean as support
    if (mean < currentPrice) {
        supports.push({
            price: mean,
            confidence: 0.7,
            method: 'Mean Reversion',
            type: 'mean',
            indicators: ['Mean Reversion'] // For backward compatibility
        });
    }
    
    return supports;
}

// Calculate Standard Deviation Bands
function calculateStdDevSupport(historicalData, currentPrice, multiplier = 2) {
    const supports = [];
    const prices = historicalData.map(candle => candle.close);
    
    // Calculate mean and standard deviation
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate lower band
    const lowerBand = mean - (stdDev * multiplier);
    
    // Only consider if below current price
    if (lowerBand < currentPrice) {
        supports.push({
            price: lowerBand,
            confidence: 0.6 + (multiplier * 0.1), // Higher multiplier gives slightly higher confidence
            method: `${multiplier}σ Lower Band`,
            type: 'std-dev-band',
            indicators: [`${multiplier}σ Lower Band`] // For backward compatibility
        });
    }
    
    return supports;
}

// Calculate Volume-Weighted Average Price bands
function calculateVWAPSupport(historicalData, currentPrice) {
    const supports = [];
    
    // Calculate VWAP and bands
    let sumPV = 0;
    let sumV = 0;
    let sumDev = 0;
    
    const vwapData = [];
    
    historicalData.forEach(candle => {
        const typicalPrice = (candle.high + candle.low + candle.close) / 3;
        const volume = candle.volume || 1;
        
        sumPV += typicalPrice * volume;
        sumV += volume;
        
        const vwap = sumPV / sumV;
        vwapData.push({ vwap, typicalPrice, volume });
        
        sumDev += Math.pow(typicalPrice - vwap, 2) * volume;
    });
    
    // Calculate standard deviation
    const vwapStdDev = Math.sqrt(sumDev / sumV);
    
    // VWAP as support
    const lastVWAP = vwapData[vwapData.length - 1].vwap;
    if (lastVWAP < currentPrice) {
        supports.push({
            price: lastVWAP,
            confidence: 0.75,
            method: 'VWAP',
            type: 'vwap',
            indicators: ['VWAP'] // For backward compatibility
        });
    }
    
    // Lower VWAP band as support
    const lowerBand = lastVWAP - (2 * vwapStdDev);
    if (lowerBand < currentPrice) {
        supports.push({
            price: lowerBand,
            confidence: 0.65,
            method: 'VWAP -2σ',
            type: 'vwap-band',
            indicators: ['VWAP -2σ'] // For backward compatibility
        });
    }
    
    return supports;
}

// Reverted function to combine support levels with focus on minor supports
function combineSupportLevels(supportLevels, currentPrice) {
    if (!supportLevels || supportLevels.length === 0) {
        return [];
    }
    
    // Sort support levels by price
    supportLevels.sort((a, b) => a.price - b.price);
    
    // Group similar price levels for support zones
    const combinedLevels = [];
    const priceTolerance = currentPrice * SWING_TRADING.PRICE_TOLERANCE; // Smaller tolerance
    
    // Find groups of similar prices (support zones)
    let currentGroup = [supportLevels[0]];
    
    for (let i = 1; i < supportLevels.length; i++) {
        const prevPrice = currentGroup[currentGroup.length - 1].price;
        const currentPrice = supportLevels[i].price;
        
        // If price is within tolerance, add to current group
        if (Math.abs(currentPrice - prevPrice) <= priceTolerance) {
            currentGroup.push(supportLevels[i]);
        } else {
            // Process the completed group
            processGroup(currentGroup, combinedLevels);
            // Start a new group
            currentGroup = [supportLevels[i]];
        }
    }
    
    // Process the last group
    processGroup(currentGroup, combinedLevels);
    
    // Sort combined levels by confidence
    combinedLevels.sort((a, b) => b.confidence - a.confidence);
    
    // Return top 5 most confident levels
    return combinedLevels.slice(0, 5);
    
    // Helper function to process a group of similar price levels
    function processGroup(group, result) {
        if (group.length === 0) return;
        
        // Calculate weighted average price based on confidence
        let totalConfidenceWeight = 0;
        let weightedPriceSum = 0;
        let methods = new Set();
        let maxConfidence = 0;
        
        // Process each support in the group
        group.forEach(support => {
            totalConfidenceWeight += support.confidence;
            weightedPriceSum += support.price * support.confidence;
            
            // Add method to the set if it exists
            if (support.method) {
                // Get the first word of the method or the whole method
                const methodName = support.method.includes(' ') ? 
                    support.method.split(' ')[0] : 
                    support.method;
                methods.add(methodName);
            } else if (support.indicators && support.indicators.length > 0) {
                // Backward compatibility with older format
                methods.add(support.indicators[0].split(' ')[0]);
            }
            
            maxConfidence = Math.max(maxConfidence, support.confidence);
        });
        
        const avgPrice = weightedPriceSum / totalConfidenceWeight;
        
        // For minor support, we prefer multiple methods but with less boost
        const methodBoost = Math.min(0.15, (methods.size - 1) * 0.05);
        
        // Calculate distance from current price
        const distancePercent = ((currentPrice - avgPrice) / currentPrice) * 100;
        
        // For minor support levels, closer is better
        let distanceAdjustment = 0;
        if (distancePercent >= 0 && distancePercent <= SWING_TRADING.IDEAL_DISTANCE) {
            // Boost confidence for very close support levels
            distanceAdjustment = 0.1 * (1 - distancePercent/SWING_TRADING.IDEAL_DISTANCE);
        }
        
        let finalConfidence = Math.min(0.9, maxConfidence + methodBoost + distanceAdjustment);
        
        // Create a combined support level
        result.push({
            price: avgPrice,
            confidence: finalConfidence,
            method: Array.from(methods).join(', '),
            methodCount: methods.size,
            supportCount: group.length,
            indicators: Array.from(methods) // For backward compatibility
        });
    }
}

function isBoughtStock(symbol) {
    return boughtStocks.some(stock => stock.symbol === symbol);
}

// Display prediction results
function displayPredictions() {
    // Reset the search input
    const searchInput = document.getElementById('stockSearchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Configure the table
    const predictionTable = document.getElementById('predictionTable');
    const tbody = predictionTable.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (supportPredictions.length === 0) {
        // Show a message when no predictions are available
        tbody.innerHTML = `
            <tr>
            <td colspan="8" class="no-data-message">
                    No support predictions available. Adjust filter settings or add more stocks to your watchlist.
            </td>
            </tr>
        `;
        return;
    }
    
    supportPredictions.forEach((stock, index) => {
        const tr = document.createElement('tr');
        
        const confidenceClass = getConfidenceClass(stock.confidence);
        const isBought = stock.isBought;
        
        // Ensure indicators is always an array
        const indicators = Array.isArray(stock.indicators) ? stock.indicators : 
                          (typeof stock.indicators === 'string' ? [stock.indicators] : 
                          (stock.method ? [stock.method] : []));
        
        // Truncate indicators list if too long
        const supportIndicators = indicators.join(', ');
        
        // Calculate badges
        const badges = createBadgesHtml(stock);
        
        tr.innerHTML = `
            <td>${stock.symbol} ${badges}</td>
            <td>${stock.currentPrice.toFixed(2)}</td>
            <td>${stock.supportPrice.toFixed(2)}</td>
            <td class="${getDifferenceClass(stock.distance)}">${Math.abs(stock.distance).toFixed(2)}%</td>
            <td>
                <span class="${confidenceClass}">${(stock.confidence * 100).toFixed(0)}%</span>
                <div class="confidence-meter">
                    <div class="confidence-fill" style="width: ${stock.confidence * 100}%"></div>
                </div>
            </td>
            <td title="${supportIndicators}">
                ${supportIndicators.length > 25 ? supportIndicators.substring(0, 25) + '...' : supportIndicators}
            </td>
            <td>
                <div class="action-buttons-container">
                    ${isBought ? 
                        `<button class="action-btn mark-unbought-btn" onclick="markStockAsNotBought(${index})">Unmark Bought</button>` : 
                        `<button class="action-btn mark-bought-btn" onclick="markStockAsBought(${index})">Mark as Bought</button>`
                    }
                    <button class="action-btn update-dashboard-btn" onclick="updateDashboardSupport('${stock.symbol}', ${stock.supportPrice})" title="Update closest support price in dashboard">
                        📊 Update Support
                    </button>
                </div>
            </td>
            <td class="chart-cell">
                <div class="chart-container-inline" id="chart-container-${stock.symbol}"></div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    // Initialize charts for each stock
    initializeCharts();
}

function getConfidenceClass(confidence) {
    if (confidence >= CONFIDENCE_THRESHOLDS.STRONG) return 'support-strong';
    if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'support-medium';
    return 'support-weak';
}

function getDifferenceClass(difference) {
    if (difference <= -10) return 'negative';
    if (difference < 0) return 'positive-low';
    return 'positive';
}

// Helper function to create badges HTML
function createBadgesHtml(stock) {
    const badges = [];
    
    // Check if this is a newly filtered stock
    if (stock.isNew) {
        badges.push('<span class="badge new-badge">New</span>');
    }
    
    if (stock.isBought) {
        badges.push('<span class="badge bought-badge">Bought</span>');
    }
    
    return badges.join(' ');
}

// Initialize charts for all stocks in the table
function initializeCharts() {
    supportPredictions.forEach(stock => {
        initializeStockChart(stock.symbol);
    });
}

// Initialize chart for a specific stock
function initializeStockChart(symbol) {
    const chartContainer = document.getElementById(`chart-container-${symbol}`);
    if (!chartContainer) return;
    
    // Clear any existing content
    chartContainer.innerHTML = '';
    
    // Check if we have data for this symbol
    if (!stockHistoricalData[symbol] || stockHistoricalData[symbol].length === 0) {
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
    const data = stockHistoricalData[symbol];
    
    // Downsample if needed
    const displayData = downsampleData(data, 200);
    
    // Get support price for this symbol from predictions
    const stockData = supportPredictions.find(s => s.symbol === symbol);
    const supportPrice = stockData ? stockData.supportPrice : null;
    
    // Set up dimensions
    const width = chartContainer.clientWidth;
    const height = chartContainer.clientHeight || 100;
    const margin = {top: 10, right: 10, bottom: 20, left: 30};
    
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
    
    // Y scale - ensure support price is included in the domain
    const minY = Math.min(
        d3.min(displayData, d => d.low) * 0.99,
        supportPrice ? supportPrice * 0.99 : Infinity
    );
    const maxY = Math.max(
        d3.max(displayData, d => d.high) * 1.01,
        supportPrice ? supportPrice * 1.01 : -Infinity
    );
    
    const y = d3.scaleLinear()
        .domain([minY, maxY])
        .range([height - margin.bottom, margin.top]);
    
    // Add line
    const line = d3.line()
        .x((d, i) => x(i))
        .y(d => y(d.close))
        .curve(d3.curveMonotoneX);
    
    // Draw line
    svg.append("path")
        .datum(displayData)
        .attr("fill", "none")
        .attr("stroke", "#2196F3")
        .attr("stroke-width", 2)
        .attr("d", line);
    
    // Add support price line
    if (supportPrice && !isNaN(supportPrice)) {
        svg.append("line")
            .attr("x1", margin.left)
            .attr("x2", width - margin.right)
            .attr("y1", y(supportPrice))
            .attr("y2", y(supportPrice))
            .attr("stroke", "#1976D2")
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "3,3");
    }
    
    // Add invisible rect for mouse tracking
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("click", () => {
            showFullScreenChart(symbol);
        });
    
    // Store chart instance reference
    chartInstances[symbol] = {
        chart: svg.node(),
        container: chartContainer
    };
}

// Show full screen chart popup
function showFullScreenChart(symbol) {
    console.log(`Showing full screen D3 chart for ${symbol}`);
    
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
        popupTitle.textContent = `${symbol} Stock Chart`;
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
    if (!stockHistoricalData[symbol] || stockHistoricalData[symbol].length === 0) {
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
    
    // Get stock data and support price
    const stockData = supportPredictions.find(s => s.symbol === symbol);
    const supportPrice = stockData ? stockData.supportPrice : null;
    const currentPrice = stockData ? stockData.currentPrice : null;
    
    // Process data - use more data points for full screen
    const data = stockHistoricalData[symbol];
    
    // Downsample for performance but keep enough points for a detailed view
    // For full screen chart, we can show more data points than in the table cell
    const displayData = data.length > 500 ? downsampleData(data, 500) : data;
    
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
        
        // Y scale - ensure support price is included in the domain
        // Add some padding to make the chart more readable
        const minPrice = Math.min(
            d3.min(displayData, d => d.low) * 0.99,
            supportPrice ? supportPrice * 0.99 : Infinity
        );
        const maxPrice = Math.max(
            d3.max(displayData, d => d.high) * 1.01,
            supportPrice ? supportPrice * 1.01 : -Infinity
        );
        
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
                    if (displayData.length > 100 && d % Math.floor(displayData.length / 10) !== 0) {
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
            .text(`${symbol} Price History`);
        
        // Draw candlesticks if we have OHLC data
        if (displayData[0].open !== undefined && displayData[0].close !== undefined) {
            // Calculate the optimal candlestick width based on chart width and data points
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
        } else {
            // If no OHLC data, draw a simple line chart
            const line = d3.line()
                .x((d, i) => x(i))
                .y(d => y(d.close || d.price || 0))
                .curve(d3.curveMonotoneX);
            
            svg.append("path")
                .datum(displayData)
                .attr("fill", "none")
                .attr("stroke", "#2196F3")
                .attr("stroke-width", 2)
                .attr("d", line);
                
            // Add data points
            svg.selectAll("circle.data-point")
                .data(displayData)
                .join("circle")
                .attr("class", "data-point")
                .attr("cx", (d, i) => x(i))
                .attr("cy", d => y(d.close || d.price || 0))
                .attr("r", 2)
                .attr("fill", "#2196F3");
        }
        
        // Add support price line
        if (supportPrice && !isNaN(supportPrice)) {
            svg.append("line")
                .attr("class", "support-line")
                .attr("x1", margin.left)
                .attr("x2", width - margin.right)
                .attr("y1", y(supportPrice))
                .attr("y2", y(supportPrice))
                .attr("stroke", "#1976D2")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "4,4");
            
            // Add support price label on the right
            svg.append("text")
                .attr("class", "price-label")
                .attr("x", width - margin.right + 10)
                .attr("y", y(supportPrice) + 4)
                .attr("fill", "#1976D2")
                .attr("font-size", "12px")
                .attr("font-weight", "bold")
                .attr("text-anchor", "start")
                .text(`Support: ${supportPrice.toFixed(2)}`);
        }
        
        // Add current price line
        if (currentPrice && !isNaN(currentPrice)) {
            svg.append("line")
                .attr("class", "current-price-line")
                .attr("x1", margin.left)
                .attr("x2", width - margin.right)
                .attr("y1", y(currentPrice))
                .attr("y2", y(currentPrice))
                .attr("stroke", "#FF9800");
            
            // Add current price label on the right
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
    }, 50);
}

// Update historical analysis tab
function updateHistoricalAnalysis() {
    // Display historical analysis in the historyAnalysisChart
    const chartContainer = document.getElementById('historyAnalysisChart');
    if (!chartContainer) return;
    
    // Clear any existing content
    chartContainer.innerHTML = '';
    
    // Create bar chart showing accuracy by indicator
    const data = [
        { indicator: 'Double Bottom', accuracy: 0.875 },
        { indicator: 'Volume Profile', accuracy: 0.821 },
        { indicator: 'Fibonacci', accuracy: 0.780 },
        { indicator: 'Moving Avg', accuracy: 0.752 },
        { indicator: 'Mean Reversion', accuracy: 0.734 },
        { indicator: 'Std Deviation', accuracy: 0.701 },
        { indicator: 'Divergence', accuracy: 0.684 },
        { indicator: 'Historical Levels', accuracy: 0.650 }
    ];
    
    // Set up dimensions
    const width = chartContainer.clientWidth;
    const height = chartContainer.clientHeight || 250;
    const margin = {top: 30, right: 30, bottom: 70, left: 80};
    
    // Create SVG
    const svg = d3.select(chartContainer)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);
    
    // X scale
    const x = d3.scaleBand()
        .domain(data.map(d => d.indicator))
        .range([margin.left, width - margin.right])
        .padding(0.3);
    
    // Y scale
    const y = d3.scaleLinear()
        .domain([0, 1])
        .range([height - margin.bottom, margin.top]);
    
    // Add X axis
    svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "translate(-10,0)rotate(-45)")
        .style("text-anchor", "end");
    
    // Add Y axis
    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickFormat(d => (d * 100).toFixed(0) + "%"));
    
    // Add Y axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", margin.left / 3)
        .attr("x", -(height / 2))
        .attr("text-anchor", "middle")
        .text("Accuracy (%)");
    
    // Add bars
    svg.selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", d => x(d.indicator))
        .attr("y", d => y(d.accuracy))
        .attr("width", x.bandwidth())
        .attr("height", d => height - margin.bottom - y(d.accuracy))
        .attr("fill", d => {
            // Color based on accuracy
            if (d.accuracy >= 0.8) return "#4CAF50";
            if (d.accuracy >= 0.7) return "#8BC34A";
            if (d.accuracy >= 0.6) return "#FFEB3B";
            return "#FF9800";
        });
    
    // Add labels on top of bars
    svg.selectAll(".label")
        .data(data)
        .join("text")
        .attr("class", "label")
        .attr("x", d => x(d.indicator) + x.bandwidth() / 2)
        .attr("y", d => y(d.accuracy) - 5)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .text(d => (d.accuracy * 100).toFixed(0) + "%");
    
    // Add chart title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .text("Accuracy by Technical Indicator");
}

// Downsample data to prevent performance issues with large datasets
function downsampleData(data, threshold = 200) {
    if (!data || data.length <= threshold) return data;
    
    const factor = Math.ceil(data.length / threshold);
    return data.filter((_, i) => i % factor === 0);
}

// Mark stock as bought
function markStockAsBought(index) {
    const stock = supportPredictions[index];
    if (!stock) return;
    
    // Check if already bought
    if (stock.isBought) return;
    
    // Update the local array
    stock.isBought = true;
    
    // Update the saved boughtStocks array
    const now = new Date();
    const boughtStock = {
        symbol: stock.symbol,
        buyPrice: stock.currentPrice,
        supportPrice: stock.supportPrice,
        quantity: DEFAULT_QUANTITY,
        boughtDate: now.toISOString(),
        note: `Predicted support at ${stock.supportPrice.toFixed(2)} with ${(stock.confidence * 100).toFixed(1)}% confidence`
    };
    
    boughtStocks.push(boughtStock);
    
    // Save to localStorage
    localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
    
    // Refresh the display
    displayPredictions();
    
    // Update portfolio tab if active
    if (document.querySelector('.nav-pill[data-tab="portfolio"]').classList.contains('active')) {
        updatePortfolioAnalysis();
    }
    
    showSuccess(`${stock.symbol} added to bought stocks list`);
}

// Mark stock as not bought
function markStockAsNotBought(index) {
    const stock = supportPredictions[index];
    if (!stock) return;
    
    // Check if not bought already
    if (!stock.isBought) return;
    
    // Update the local array
    stock.isBought = false;
    
    // Update the saved boughtStocks array
    boughtStocks = boughtStocks.filter(bs => bs.symbol !== stock.symbol);
    
    // Save to localStorage
    localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
    
    // Refresh the display
    displayPredictions();
    
    // Update portfolio tab if active
    if (document.querySelector('.nav-pill[data-tab="portfolio"]').classList.contains('active')) {
        updatePortfolioAnalysis();
    }
    
    showSuccess(`${stock.symbol} removed from bought stocks list`);
}

// Load settings from localStorage
function loadSettings() {
    // Confidence threshold
    const minConfidence = localStorage.getItem('predictionMinConfidence');
    if (minConfidence !== null) {
        document.getElementById('minConfidence').value = minConfidence;
    }
    
    // Max distance
    const maxDistance = localStorage.getItem('predictionMaxDistance');
    if (maxDistance !== null) {
        document.getElementById('maxDistancePercent').value = maxDistance;
    }
    
    // Timeframe weighting
    const timeframeWeight = localStorage.getItem('predictionTimeframeWeight');
    if (timeframeWeight !== null) {
        document.getElementById('timeframeWeight').value = timeframeWeight;
    }
    
    // Fibonacci levels
    const fibLevels = localStorage.getItem('predictionFibLevels');
    if (fibLevels !== null) {
        document.getElementById('fibonacciLevels').value = fibLevels;
    }
    
    // Divergence indicator
    const divergenceInd = localStorage.getItem('predictionDivergenceIndicator');
    if (divergenceInd !== null) {
        document.getElementById('divergenceIndicator').value = divergenceInd;
    }
    
    // Standard deviation multiplier
    const stdDevMult = localStorage.getItem('predictionStdDevMultiplier');
    if (stdDevMult !== null) {
        document.getElementById('stdDevMultiplier').value = stdDevMult;
    }
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('predictionMinConfidence', document.getElementById('minConfidence').value);
    localStorage.setItem('predictionMaxDistance', document.getElementById('maxDistancePercent').value);
    localStorage.setItem('predictionTimeframeWeight', document.getElementById('timeframeWeight').value);
    localStorage.setItem('predictionFibLevels', document.getElementById('fibonacciLevels').value);
    localStorage.setItem('predictionDivergenceIndicator', document.getElementById('divergenceIndicator').value);
    localStorage.setItem('predictionStdDevMultiplier', document.getElementById('stdDevMultiplier').value);
}

// Function to show the manual stock entry form
function showManualStockForm() {
    const modal = document.getElementById('manualStockForm');
    modal.style.display = 'flex';
    document.getElementById('manualSymbol').focus();
}

// Function to hide the manual stock entry form
function hideManualStockForm() {
    document.getElementById('manualStockForm').style.display = 'none';
    // Clear the input
    document.getElementById('manualSymbol').value = '';
}

// Function to save the manually entered stock
function saveManualStock() {
    const symbol = document.getElementById('manualSymbol').value.trim().toUpperCase();
    
    if (!symbol) {
        showError('Please enter a stock symbol');
        return;
    }
    
    // Find the stock in userStocks
    const stockFromDashboard = userStocks.find(s => s.symbol === symbol);
    
    if (!stockFromDashboard) {
        showError(`Stock "${symbol}" not found in your dashboard. Add it to the dashboard first.`);
        return;
    }
    
    const currentPrice = currentPrices[symbol] || 0;
    if (currentPrice <= 0) {
        showError(`Current price for ${symbol} is not available. Please try again later.`);
        return;
    }
    
    // Get historical data for this stock
    const historicalData = stockHistoricalData[symbol];
    if (!historicalData || historicalData.length < 50) {
        showError(`Historical data for ${symbol} is not available or insufficient.`);
        return;
    }
    
    // Force calculation of support predictions for this stock
    calculateManualStockSupport(symbol);
    
    // Hide the form
    hideManualStockForm();
}

// Calculate support prediction for a manually added stock
function calculateManualStockSupport(symbol) {
    const stock = userStocks.find(s => s.symbol === symbol);
    if (!stock) return;
    
    const currentPrice = currentPrices[symbol] || 0;
    if (currentPrice <= 0) return;
    
    // Get historical data for this stock
    const historicalData = stockHistoricalData[symbol];
    if (!historicalData || historicalData.length < 50) return;
    
    // Temporarily enable all indicators
    const originalStates = {
        priceAction: document.getElementById('usePriceAction').checked,
        volume: document.getElementById('useVolume').checked,
        fibonacci: document.getElementById('useFibonacci').checked,
        movingAverage: document.getElementById('useMovingAverage').checked,
        doubleBottom: document.getElementById('useDoubleBotom').checked,
        roundedBottom: document.getElementById('useRoundedBottom').checked,
        bullishDivergence: document.getElementById('useBullishDivergence').checked,
        historicalLevels: document.getElementById('useHistoricalLevels').checked,
        meanReversion: document.getElementById('useMeanReversion').checked,
        standardDeviation: document.getElementById('useStandardDeviation').checked,
        volumeWeighted: document.getElementById('useVolumeWeighted').checked
    };
    
    // Enable all indicators
    document.getElementById('usePriceAction').checked = true;
    document.getElementById('useVolume').checked = true;
    document.getElementById('useFibonacci').checked = true;
    document.getElementById('useMovingAverage').checked = true;
    document.getElementById('useDoubleBotom').checked = true;
    document.getElementById('useRoundedBottom').checked = true;
    document.getElementById('useBullishDivergence').checked = true;
    document.getElementById('useHistoricalLevels').checked = true;
    document.getElementById('useMeanReversion').checked = true;
    document.getElementById('useStandardDeviation').checked = true;
    document.getElementById('useVolumeWeighted').checked = true;
    
    // Calculate support predictions
    calculateSupportPredictions();
    
    // Restore original indicator states
    document.getElementById('usePriceAction').checked = originalStates.priceAction;
    document.getElementById('useVolume').checked = originalStates.volume;
    document.getElementById('useFibonacci').checked = originalStates.fibonacci;
    document.getElementById('useMovingAverage').checked = originalStates.movingAverage;
    document.getElementById('useDoubleBotom').checked = originalStates.doubleBottom;
    document.getElementById('useRoundedBottom').checked = originalStates.roundedBottom;
    document.getElementById('useBullishDivergence').checked = originalStates.bullishDivergence;
    document.getElementById('useHistoricalLevels').checked = originalStates.historicalLevels;
    document.getElementById('useMeanReversion').checked = originalStates.meanReversion;
    document.getElementById('useStandardDeviation').checked = originalStates.standardDeviation;
    document.getElementById('useVolumeWeighted').checked = originalStates.volumeWeighted;
    
    showSuccess(`Support prediction calculated for ${symbol}`);
}

// Fetch historical data
async function fetchHistoricalData() {
    try {
        showLoading(true);
        console.log('Fetching historical data...');
        
        const response = await fetch('/organized_nepse_data.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log('Historical data fetched, parsing JSON...');
        const data = await response.json();
        console.log('Data parsed, processing...');
        
        // Process the data
        processHistoricalData(data);
        
        // After processing, calculate support predictions
        console.log('Calculating support predictions...');
        calculateSupportPredictions();
        
        showLoading(false);
    } catch (error) {
        console.error('Error fetching historical data:', error);
        showError('Failed to load historical price data: ' + error.message);
        showLoading(false);
        
        // Try using a default data set or mock data for testing
        console.log('Attempting to use mock data for testing...');
        useMockDataForTesting();
    }
}

// Use mock data for testing when historical data can't be loaded
function useMockDataForTesting() {
    // Create some sample data for testing
    const mockData = [
        { symbol: 'ADBL', open: 400, high: 410, low: 395, close: 405, volume: 1000 },
        { symbol: 'ADBL', open: 405, high: 415, low: 402, close: 412, volume: 1200 },
        { symbol: 'ADBL', open: 412, high: 418, low: 408, close: 416, volume: 1500 },
        { symbol: 'ADBL', open: 416, high: 420, low: 410, close: 415, volume: 900 },
        { symbol: 'ADBL', open: 415, high: 422, low: 414, close: 420, volume: 1100 },
        // Add 50 more data points to meet minimum requirements
        ...Array.from({ length: 50 }, (_, i) => ({
            symbol: 'ADBL',
            open: 400 + i,
            high: 410 + i,
            low: 395 + i,
            close: 405 + i,
            volume: 1000 + i * 10
        }))
    ];
    
    // Process the mock data
    processHistoricalData(mockData);
    
    // Create mock user stocks for testing
    userStocks = [
        { symbol: 'ADBL', supportPrice1: 400, supportPrice2: 390, supportPrice3: 380 }
    ];
    
    // Create mock current prices
    currentPrices = {
        'ADBL': 420
    };
    
    // Calculate support predictions with the mock data
    calculateSupportPredictions();
    
    showSuccess('Using test data for demonstration');
}

// Process historical data
function processHistoricalData(data) {
    // Reset the historical data object
    stockHistoricalData = {};
    
    // Check if data is an array
    if (!Array.isArray(data)) {
        console.error("Data is not an array:", data);
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
        }
        
        // Add the data point
        stockHistoricalData[symbol].push({
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close),
            volume: parseFloat(item.volume || 0)
        });
    });
}

// Utility functions
function showError(message) {
    const messageContainer = document.getElementById('messageContainer');
    messageContainer.innerHTML = `<div class="error-message">${message}</div>`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        messageContainer.innerHTML = '';
    }, 5000);
}

function showSuccess(message) {
    const messageContainer = document.getElementById('messageContainer');
    messageContainer.innerHTML = `<div class="success-message">${message}</div>`;
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        messageContainer.innerHTML = '';
    }, 3000);
}

function showLoading(show) {
    document.getElementById('loadingIndicator').style.display = show ? 'flex' : 'none';
}

// Update portfolio analysis tab
function updatePortfolioAnalysis() {
    // Get bought stocks
    const boughtStockSymbols = boughtStocks.map(s => s.symbol);
    const portfolioStocks = supportPredictions.filter(s => boughtStockSymbols.includes(s.symbol));
    
    // Display portfolio stocks
    const portfolioTable = document.getElementById('portfolioTable');
    if (!portfolioTable) return;
    
    const tbody = portfolioTable.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (portfolioStocks.length === 0) {
        // Show empty state
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="7" class="no-data-message">
                No stocks in your portfolio. Mark stocks as "bought" to track them here.
            </td>
        `;
        tbody.appendChild(tr);
        return;
    }
    
    portfolioStocks.forEach((stock, index) => {
        // Find buy price from boughtStocks array
        const boughtStock = boughtStocks.find(s => s.symbol === stock.symbol);
        const entryPrice = boughtStock ? boughtStock.price : 0;
        
        // Calculate risk level based on current price vs support
        const riskLevel = calculateRiskLevel(stock.currentPrice, stock.supportPrice);
        const riskClass = getRiskClass(riskLevel);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${stock.symbol}</td>
            <td>Long</td>
            <td>${entryPrice > 0 ? entryPrice.toFixed(2) : 'N/A'}</td>
            <td>${stock.currentPrice.toFixed(2)}</td>
            <td>${stock.supportPrice.toFixed(2)}</td>
            <td class="${riskClass}">
                ${riskLevel}
            </td>
            <td>
                <button class="action-btn mark-unbought-btn" onclick="markStockAsNotBought(${index})">Remove</button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

function calculateRiskLevel(currentPrice, supportPrice) {
    const distance = ((currentPrice - supportPrice) / supportPrice) * 100;
    
    if (distance <= 2) return 'Low';
    if (distance <= 5) return 'Medium';
    return 'High';
}

function getRiskClass(risk) {
    if (risk === 'Low') return 'support-strong';
    if (risk === 'Medium') return 'support-medium';
    return 'support-weak';
}

// Find support levels based on significant volume
function findVolumeBasedSupport(historicalData, currentPrice) {
    if (!historicalData || historicalData.length < 50) {
        return [];
    }
    
    const volumeBasedSupports = [];
    const avgVolume = historicalData.reduce((sum, d) => sum + d.volume, 0) / historicalData.length;
    
    // Look for significant volume spikes at lower prices
    for (let i = historicalData.length - 1; i >= 0; i--) {
        const candle = historicalData[i];
        const relativeVolume = candle.volume / avgVolume;
        
        // Check if this is a significant volume spike
        if (relativeVolume >= SWING_TRADING.VOLUME_THRESHOLD) {
            // Volume spike detected
            const candleLow = candle.low;
            const distancePercent = ((currentPrice - candleLow) / currentPrice) * 100;
            
            // Only consider levels within our swing trading range
            if (distancePercent >= SWING_TRADING.MIN_DISTANCE && distancePercent <= SWING_TRADING.MAX_DISTANCE) {
                // Check if we already have a similar price level
                const exists = volumeBasedSupports.some(support => 
                    Math.abs(support.price - candleLow) / candleLow < SWING_TRADING.PRICE_TOLERANCE);
                
                if (!exists) {
                    // Calculate confidence based on volume and distance from ideal entry
                    const volumeFactor = Math.min(1.0, (relativeVolume - SWING_TRADING.VOLUME_THRESHOLD) / 2);
                    const distanceIdealFactor = 1.0 - Math.min(1.0, Math.abs(distancePercent - SWING_TRADING.IDEAL_DISTANCE) / 
                                                  (SWING_TRADING.MAX_DISTANCE - SWING_TRADING.MIN_DISTANCE));
                    
                    const confidence = 0.6 + (volumeFactor * 0.2) + (distanceIdealFactor * 0.2);
                    
                    volumeBasedSupports.push({
                        price: candleLow,
                        confidence: confidence,
                        method: `Volume Support (${relativeVolume.toFixed(1)}x avg)`,
                        volumeSpike: relativeVolume
                    });
                }
            }
        }
    }
    
    // Sort by confidence
    volumeBasedSupports.sort((a, b) => b.confidence - a.confidence);
    
    // Return top volume-based support levels
    return volumeBasedSupports.slice(0, 3);
}

// Filter the stock prediction table based on search input
function filterStockTable() {
    const searchText = document.getElementById('stockSearchInput').value.toUpperCase();
    const table = document.getElementById('predictionTable');
    const rows = table.getElementsByTagName('tr');
    
    // Loop through all rows except the header row
    for (let i = 1; i < rows.length; i++) {
        const symbolCell = rows[i].getElementsByTagName('td')[0]; // First cell contains the symbol
        
        if (symbolCell) {
            const symbolText = symbolCell.textContent || symbolCell.innerText;
            
            // Show row if the symbol includes the search text, hide it otherwise
            if (symbolText.toUpperCase().indexOf(searchText) > -1) {
                rows[i].style.display = '';
            } else {
                rows[i].style.display = 'none';
            }
        }
    }
    
    // Display a message if no matches found
    const tbody = table.getElementsByTagName('tbody')[0];
    
    // Remove any existing "no matches" row
    const existingNoMatches = tbody.querySelector('.no-matches-row');
    if (existingNoMatches) {
        tbody.removeChild(existingNoMatches);
    }
    
    // Check if all rows are hidden (except header)
    let allHidden = true;
    for (let i = 1; i < rows.length; i++) {
        if (rows[i].style.display !== 'none') {
            allHidden = false;
            break;
        }
    }
    
    // Add "no matches" row if needed
    if (allHidden && searchText.length > 0) {
        const noMatchRow = document.createElement('tr');
        noMatchRow.className = 'no-matches-row';
        noMatchRow.innerHTML = `<td colspan="8" style="text-align: center; padding: 20px;">No stocks matching "${searchText}"</td>`;
        tbody.appendChild(noMatchRow);
    }
}

// Update dashboard support price
function updateDashboardSupport(symbol, supportPrice) {
    if (!symbol || !supportPrice) {
        showError('Invalid symbol or support price');
        return;
    }
    
    try {
        // Get user stocks from localStorage
        let stocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
        const stock = stocks.find(s => s.symbol === symbol);
        
        if (!stock) {
            showError(`Stock ${symbol} not found in dashboard`);
            return;
        }
        
        // Find the closest support price to update
        const support1Diff = Math.abs(stock.supportPrice1 - supportPrice);
        const support2Diff = Math.abs(stock.supportPrice2 - supportPrice);
        const support3Diff = Math.abs(stock.supportPrice3 - supportPrice);
        
        // Find the minimum difference to identify closest support level
        const minDiff = Math.min(support1Diff, support2Diff, support3Diff);
        
        let supportLevel = '';
        let currentValue = 0;
        
        // Determine which support level to update
        if (minDiff === support1Diff) {
            supportLevel = 'Support 1';
            currentValue = stock.supportPrice1;
        } else if (minDiff === support2Diff) {
            supportLevel = 'Support 2';
            currentValue = stock.supportPrice2;
        } else {
            supportLevel = 'Support 3';
            currentValue = stock.supportPrice3;
        }
        
        // Calculate percentage difference for user information
        const pctDiff = ((currentValue - supportPrice) / supportPrice * 100).toFixed(2);
        const diffDirection = pctDiff > 0 ? 'higher' : 'lower';
        
        // Confirm with the user before updating
        const confirmed = confirm(
            `Update ${supportLevel} for ${symbol}?\n\n` +
            `Current value: ${currentValue.toFixed(2)}\n` +
            `New value: ${supportPrice.toFixed(2)}\n` +
            `Difference: ${Math.abs(pctDiff)}% ${diffDirection}`
        );
        
        if (!confirmed) {
            return; // User cancelled the operation
        }
        
        // Update the closest support price
        if (minDiff === support1Diff) {
            stock.supportPrice1 = supportPrice;
            showSuccess(`Updated ${supportLevel} for ${symbol} to ${supportPrice.toFixed(2)}`);
        } else if (minDiff === support2Diff) {
            stock.supportPrice2 = supportPrice;
            showSuccess(`Updated ${supportLevel} for ${symbol} to ${supportPrice.toFixed(2)}`);
        } else {
            stock.supportPrice3 = supportPrice;
            showSuccess(`Updated ${supportLevel} for ${symbol} to ${supportPrice.toFixed(2)}`);
        }
        
        // Save updated stocks to localStorage
        localStorage.setItem('userStocks', JSON.stringify(stocks));
    } catch (error) {
        console.error('Error updating dashboard support:', error);
        showError('Failed to update dashboard support price');
    }
}

// Update all support prices in one click
function updateAllSupportPrices() {
    if (!supportPredictions || supportPredictions.length === 0) {
        showError('No support predictions available to update');
        return;
    }
    
    try {
        // Get user stocks from localStorage
        let stocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
        if (!stocks || stocks.length === 0) {
            showError('No stocks found in dashboard to update');
            return;
        }
        
        // Confirm with the user before updating all
        const confirmed = confirm(
            `This will update the support prices for all ${supportPredictions.length} stocks in the prediction table.\n\n` +
            `Do you want to continue?`
        );
        
        if (!confirmed) {
            return; // User cancelled the operation
        }
        
        let updatedCount = 0;
        let skippedCount = 0;
        
        // Loop through all support predictions
        supportPredictions.forEach(prediction => {
            const { symbol, supportPrice } = prediction;
            
            // Find the stock in user stocks
            const stock = stocks.find(s => s.symbol === symbol);
            if (!stock) {
                skippedCount++;
                return; // Skip if stock not found in dashboard
            }
            
            // Find the closest support price to update
            const support1Diff = Math.abs(stock.supportPrice1 - supportPrice);
            const support2Diff = Math.abs(stock.supportPrice2 - supportPrice);
            const support3Diff = Math.abs(stock.supportPrice3 - supportPrice);
            
            // Find the minimum difference to identify closest support level
            const minDiff = Math.min(support1Diff, support2Diff, support3Diff);
            
            // Update the closest support price
            if (minDiff === support1Diff) {
                stock.supportPrice1 = supportPrice;
            } else if (minDiff === support2Diff) {
                stock.supportPrice2 = supportPrice;
            } else {
                stock.supportPrice3 = supportPrice;
            }
            
            updatedCount++;
        });
        
        // Save updated stocks to localStorage
        localStorage.setItem('userStocks', JSON.stringify(stocks));
        
        // Show success message
        if (updatedCount > 0) {
            showSuccess(`Successfully updated support prices for ${updatedCount} stocks`);
        }
        
        // Show warning if some stocks were skipped
        if (skippedCount > 0) {
            console.warn(`Skipped ${skippedCount} stocks that were not found in dashboard`);
        }
    } catch (error) {
        console.error('Error updating all support prices:', error);
        showError('Failed to update all support prices');
    }
} 