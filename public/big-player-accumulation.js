// Global variables
let userStocks = [];
let currentPrices = {};
let stockHistoricalData = {};
let accumulationStocks = [];
let accumulationStocksHistory = JSON.parse(localStorage.getItem('accumulationStocksHistory') || '{}');
let chartInstances = {};
let boughtStocks = JSON.parse(localStorage.getItem('boughtStocks') || '[]');
let autoRefreshInterval = null;
let accumulationStocksTable = null; // Will be initialized when DOM is loaded

// Add additional CSS for table layout
document.addEventListener('DOMContentLoaded', function() {
    // Add custom CSS for table
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        /* Table styles */
        #accumulationTable {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-bottom: 20px !important;
        }
        
        #accumulationTable th, 
        #accumulationTable td {
            padding: 12px 8px !important;
            text-align: left !important;
            border-bottom: 1px solid #ddd !important;
            vertical-align: middle !important;
        }
        
        #accumulationTable th {
            background-color: #006666 !important;
            color: white !important;
            font-weight: bold !important;
        }
        
        #accumulationTable tr:hover {
            background-color: #f9f9f9 !important;
        }
        
        /* Column styles */
        .column-symbol {
            min-width: 80px !important;
            font-weight: bold !important;
        }
        
        .column-price {
            min-width: 80px !important;
            text-align: right !important;
        }
        
        .column-score {
            min-width: 100px !important;
            text-align: center !important;
        }
        
        .column-confidence {
            min-width: 100px !important;
        }
        
        .column-patterns {
            min-width: 150px !important;
        }
        
        .column-volume {
            min-width: 140px !important;
        }
        
        .column-days {
            min-width: 60px !important;
            text-align: center !important;
        }
        
        .column-actions {
            min-width: 220px !important;
        }
        
        .column-chart {
            width: 200px !important;
            max-width: 200px !important;
            overflow: hidden !important;
        }
        
        /* Icon styling */
        .icon {
            font-style: normal !important;
            font-size: 16px !important;
        }
        
        /* Action button styles */
        .action-button {
            padding: 6px 10px !important;
            margin: 2px !important;
            border-radius: 4px !important;
            border: 1px solid #ddd !important;
            background-color: #f5f5f5 !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: all 0.2s ease !important;
        }
        
        .action-button:hover {
            background-color: #e0e0e0 !important;
            transform: scale(1.05) !important;
        }
        
        .action-button.active {
            background-color: #00796b !important;
            color: white !important;
            border-color: #00796b !important;
        }
        
        /* Details button */
        .details-button {
            background-color: #2196F3 !important;
            color: white !important;
            border-color: #1976D2 !important;
        }
        
        .details-button:hover {
            background-color: #1976D2 !important;
        }
        
        /* Mark buying button */
        .mark-buying-button {
            background-color: #4CAF50 !important;
            color: white !important;
            border-color: #388E3C !important;
        }
        
        .mark-buying-button:hover {
            background-color: #388E3C !important;
        }
        
        .mark-buying-button.active {
            background-color: #388E3C !important;
            color: white !important;
        }
        
        /* Watchlist button */
        .watchlist-button {
            background-color: #FFFFFF !important;
            color: #212121 !important;
            border-color: #DDDDDD !important;
        }
        
        .watchlist-button:hover {
            background-color: #F5F5F5 !important;
        }
        
        .watchlist-button.active {
            background-color: #FFC107 !important;
            color: #212121 !important;
            border-color: #FFA000 !important;
        }
        
        /* Chart container */
        .chart-container-small {
            height: 100px !important;
            width: 100% !important;
            max-width: 200px !important;
            position: relative !important;
            overflow: hidden !important;
        }
        
        /* Chart popup styles */
        .chart-popup {
            display: none !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background-color: rgba(0, 0, 0, 0.7) !important;
            z-index: 1000 !important;
        }
        
        .chart-popup.visible {
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
        }
        
        .chart-popup-content {
            background-color: white !important;
            border-radius: 8px !important;
            width: 90% !important;
            max-width: 1200px !important;
            height: 90% !important;
            max-height: 800px !important;
            position: relative !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
        }
    `;
    document.head.appendChild(styleEl);
});

// Constants for pattern detection
const VOLUME_ANOMALY_THRESHOLD = 2.0; // 2x average volume
const OBV_DIVERGENCE_THRESHOLD = 0.15; // 15% divergence
const VWAP_DEVIATION_THRESHOLD = 0.03; // 3% deviation
const MIN_DATA_POINTS = 50; // Minimum historical data points needed
const PRICE_CONSOLIDATION_THRESHOLD = 0.10; // 10% max range for consolidation
const SPRING_THRESHOLD = 0.05; // 5% for spring identification
const RSI_OVERSOLD = 30; // RSI oversold threshold

// Check if a stock is marked as buying
function isBuyingSymbol(symbol) {
    return boughtStocks.includes(symbol);
}

// Toggle buying status of a stock
function toggleBuyingStock(index) {
    const stock = accumulationStocks[index];
    if (!stock) return;
    
    const symbol = stock.symbol;
    const boughtIndex = boughtStocks.indexOf(symbol);
    
    if (boughtIndex === -1) {
        // Add to bought stocks
        boughtStocks.push(symbol);
        showSuccess(`${symbol} marked as buying`);
    } else {
        // Remove from bought stocks
        boughtStocks.splice(boughtIndex, 1);
        showSuccess(`${symbol} removed from buying list`);
    }
    
    // Save to localStorage
    localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
    
    // Update display
    displayAccumulationStocks();
    
    // Also update the Conclusion tab separately
    updateBuyCandidates();
}

// Function to format numbers with commas for thousands
function formatNumber(num) {
    if (typeof num !== 'number') return 'N/A';
    return num.toLocaleString();
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize table reference
    accumulationStocksTable = document.querySelector('#accumulationTable tbody');
    if (!accumulationStocksTable) {
        console.error('Could not find accumulation table body element');
    }
    
    // Initialize tabs
    setupTabNavigation();
    
    // CRITICAL FIX: Force hide all tab content first
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Explicitly activate ONLY the Buy Candidates tab
    const conclusionTab = document.querySelector('.tab[data-tab="conclusion"]');
    const conclusionContent = document.getElementById('conclusionContent');
    
    if (conclusionTab) conclusionTab.classList.add('active');
    if (conclusionContent) {
        conclusionContent.classList.add('active');
        conclusionContent.style.display = 'block';
    }
    
    // Create chart popup if not exists
    if (!document.querySelector('.chart-popup')) {
        createChartPopup();
    }
    
    // Add watchlist styles
    addWatchlistStyles();
    
    // Initialize page
    initializePage();
    
    // Setup event listeners
    setupEventListeners();
    
    // Start auto-refresh if enabled
    setupAutoRefresh();
    
    // Load saved filter settings
    loadFilterSettings();
    
    // Store original functions before potentially overriding them
    const originalIsInWatchlist = window.isInWatchlist;
    const originalToggleWatchlist = window.toggleWatchlist;
    
    // Only register our functions if they don't exist globally already
    if (typeof originalIsInWatchlist !== 'function') {
        window.isInWatchlist = function(symbol) {
            return isInWatchlist(symbol);
        };
    }
    
    if (typeof originalToggleWatchlist !== 'function') {
        window.toggleWatchlist = function(symbol) {
            toggleWatchlist(symbol);
        };
    }
    
    // Add global document-level event listener for chart popup close button
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('chart-popup-close')) {
            const popup = document.querySelector('.chart-popup');
            if (popup) {
                popup.classList.remove('visible');
                popup.style.display = 'none';
            }
        }
    });
    
    // Load data in correct sequence
    loadUserStocks();
    fetchHistoricalData().then(() => {
        loadCurrentPrices();
        
        // Make sure updateBuyCandidates is called specifically to populate the default tab
        setTimeout(() => {
            updateBuyCandidates();
        }, 300);
    }).catch(error => {
        console.error("Error loading historical data:", error);
        // If historical data fails, still try to load current prices
        loadCurrentPrices();
        
        // Still try to update buy candidates
        setTimeout(() => {
            updateBuyCandidates();
        }, 300);
    });
});

// Setup tab navigation
function setupTabNavigation() {
    // Tab click event handlers
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            if (tabId) {
                // First, remove active class from all tabs and hide all content
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => {
                    c.classList.remove('active');
                    c.style.display = 'none'; // Force hide all tab content
                });
                
                // Then activate only the selected tab
                this.classList.add('active');
                const activeContent = document.getElementById(`${tabId}Content`);
                activeContent.classList.add('active');
                activeContent.style.display = 'block'; // Force show selected tab content
                
                // Perform tab-specific updates
                if (tabId === 'patterns') {
                    updatePatternAnalysis();
                } else if (tabId === 'volume') {
                    updateVolumeAnalysis();
                } else if (tabId === 'conclusion') {
                    // When switching to Buy Candidates tab, refresh the tab's content
                    // and reinitialize charts to ensure they display properly
                    updateBuyCandidates();
                } else if (tabId === 'results') {
                    // For Detection Results, make sure charts are properly initialized
                    // This helps with any chart rendering issues
                    setTimeout(() => {
                        // Find all mini-charts in the active tab and reinitialize them
                        const chartContainers = document.querySelectorAll('#resultsContent .chart-container-small');
                        chartContainers.forEach(container => {
                            const symbol = container.getAttribute('data-symbol');
                            if (symbol) {
                                initializeStockChart(symbol, container.id);
                            }
                        });
                    }, 100);
                }
            }
        });
    });
}

// Create chart popup element
function createChartPopup() {
    // Check if the popup container already exists
    let popup = document.querySelector('.chart-popup');
    
    if (!popup) {
        // Create the popup container
        popup = document.createElement('div');
        popup.className = 'chart-popup';
        
        // Create the popup content
        const popupContent = document.createElement('div');
        popupContent.className = 'chart-popup-content';
        
        // Create the header
        const popupHeader = document.createElement('div');
        popupHeader.className = 'chart-popup-header';
        
        const popupTitle = document.createElement('h3');
        popupTitle.id = 'popupChartTitle';
        popupTitle.textContent = 'Stock Chart';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'chart-popup-close';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = function() {
            popup.classList.remove('visible');
            popup.style.display = 'none';
        };
        
        popupHeader.appendChild(popupTitle);
        popupHeader.appendChild(closeButton);
        
        // Create the body
        const popupBody = document.createElement('div');
        popupBody.className = 'chart-popup-body';
        
        const chartContainer = document.createElement('div');
        chartContainer.id = 'popupChartContainer';
        
        const detailsContainer = document.createElement('div');
        detailsContainer.id = 'popupDetailsContainer';
        
        popupBody.appendChild(chartContainer);
        popupBody.appendChild(detailsContainer);
        
        // Put it all together
        popupContent.appendChild(popupHeader);
        popupContent.appendChild(popupBody);
        popup.appendChild(popupContent);
        
        // Add the popup to the document
        document.body.appendChild(popup);
    } else {
        // Make sure the close button works properly
        const closeButton = popup.querySelector('.chart-popup-close');
        if (closeButton) {
            closeButton.onclick = function() {
                popup.classList.remove('visible');
                popup.style.display = 'none';
            };
        }
    }
    
    return popup;
}

function initializePage() {
    // This function is called when DOMContentLoaded event fires
    // The actual data loading is handled in the event listener now
    console.log("Page initialized");
}

function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }
    
    // Stock search input
    const searchInput = document.getElementById('stockSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            filterDisplayedStocks(searchTerm);
        });
    }
    
    // Auto refresh button
    const autoRefreshBtn = document.getElementById('autoRefreshBtn');
    if (autoRefreshBtn) {
        autoRefreshBtn.addEventListener('click', toggleAutoRefresh);
    }
    
    // Add manual stock button
    const addManualStockBtn = document.getElementById('addManualStockBtn');
    if (addManualStockBtn) {
        addManualStockBtn.addEventListener('click', showManualStockForm);
    }
    
    // Save manual stock
    const saveManualStockBtn = document.getElementById('saveManualStockBtn');
    if (saveManualStockBtn) {
        saveManualStockBtn.addEventListener('click', saveManualStock);
    }
    
    // Cancel manual stock
    const cancelManualStockBtn = document.getElementById('cancelManualStockBtn');
    if (cancelManualStockBtn) {
        cancelManualStockBtn.addEventListener('click', hideManualStockForm);
    }
    
    // Setup global click handler for mini-charts
    document.addEventListener('click', function(event) {
        // Check if the click is on a chart container or inside one
        let chartContainer = null;
        let element = event.target;
        
        while (element && !chartContainer) {
            if (element.classList && element.classList.contains('chart-container-small')) {
                chartContainer = element;
            }
            element = element.parentElement;
        }
        
        // If we found a chart container, open the full chart
        if (chartContainer) {
            const symbol = chartContainer.getAttribute('data-symbol');
            if (symbol) {
                const stock = accumulationStocks.find(s => s.symbol === symbol);
                showFullScreenChart(symbol, stock);
            }
        }
    });
    
    // Add global click handler for action buttons including in the Buy Candidates tab
    document.addEventListener('click', function(event) {
        // Check if the click is on a button with data-symbol attribute
        if (event.target.closest('.action-button[data-symbol]')) {
            const button = event.target.closest('.action-button[data-symbol]');
            const symbol = button.getAttribute('data-symbol');
            
            if (!symbol) return;
            
            if (button.classList.contains('details-button')) {
                const stock = accumulationStocks.find(s => s.symbol === symbol);
                showFullScreenChart(symbol, stock);
            } else if (button.classList.contains('mark-buying-button')) {
                const stockIndex = accumulationStocks.findIndex(s => s.symbol === symbol);
                if (stockIndex !== -1) {
                    toggleBuyingStock(stockIndex);
                }
            } else if (button.classList.contains('watchlist-button')) {
                const stockIndex = accumulationStocks.findIndex(s => s.symbol === symbol);
                if (stockIndex !== -1) {
                    toggleWatchlistStock(stockIndex);
                    
                    // Update all watchlist buttons with this symbol in all tabs
                    document.querySelectorAll(`.watchlist-button[data-symbol="${symbol}"]`).forEach(btn => {
                        if (isInWatchlist(symbol)) {
                            btn.classList.add('active');
                            btn.querySelector('.icon').textContent = '★';
                            btn.title = 'Remove from Watchlist';
                        } else {
                            btn.classList.remove('active');
                            btn.querySelector('.icon').textContent = '☆';
                            btn.title = 'Add to Watchlist';
                        }
                    });
                }
            }
        }
    });
    
    // Tab click listeners
    setupTabNavigation();
    
    // Add OBV test button
    const testOBVBtn = document.getElementById('testOBVBtn');
    if (testOBVBtn) {
        testOBVBtn.addEventListener('click', testOBVData);
    }
}

// Function to test OBV data for debugging
function testOBVData() {
    // Get the first few symbols from user stocks
    const symbols = userStocks.slice(0, 5).map(stock => stock.symbol);
    
    if (symbols.length === 0) {
        showError('No stocks available for testing');
        return;
    }
    
    console.log("Testing OBV data for symbols:", symbols);
    
    // Check each symbol's OBV data
    symbols.forEach(symbol => {
        const data = stockHistoricalData[symbol];
        if (!data || data.length === 0) {
            console.log(`No historical data for ${symbol}`);
            return;
        }
        
        // Check if OBV is calculated
        const hasOBV = data.some(item => item.obv !== undefined);
        const obvSample = data.filter(item => item.obv !== undefined).slice(0, 5).map(item => item.obv);
        
        console.log(`OBV data for ${symbol}:`, {
            hasOBV: hasOBV,
            dataLength: data.length,
            obvSample: obvSample,
            firstFewPoints: data.slice(0, 3).map(d => ({ date: d.date, close: d.close, volume: d.volume, obv: d.obv })),
            lastFewPoints: data.slice(-3).map(d => ({ date: d.date, close: d.close, volume: d.volume, obv: d.obv }))
        });
        
        // Test the OBV trend calculation
        const obvTrend = calculateOBVTrend(data);
        console.log(`OBV trend for ${symbol}:`, obvTrend);
    });
    
    showSuccess('OBV data test completed. Check the console for results');
}

function setupAutoRefresh() {
    clearInterval(autoRefreshInterval);
    
    const isAutoRefreshEnabled = localStorage.getItem('autoRefreshEnabled') === 'true';
    if (isAutoRefreshEnabled) {
        // Refresh prices every 5 minutes
        autoRefreshInterval = setInterval(() => {
            loadCurrentPrices();
            detectAccumulationPatterns();
        }, 300000); // 5 minutes
    }
}

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

function loadUserStocks() {
    // Get user stocks from localStorage, as saved by dashboard
    userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    console.log(`Loaded ${userStocks.length} stocks from user watchlist`);
    
    // Also load bought stocks
    boughtStocks = JSON.parse(localStorage.getItem('boughtStocks') || '[]');
}

function loadCurrentPrices() {
    showLoading(true);
    try {
        // Load current prices from localStorage (set by dashboard)
        const storedPrices = localStorage.getItem('currentPrices');
        
        if (storedPrices) {
            currentPrices = JSON.parse(storedPrices);
            console.log(`Loaded current prices for ${Object.keys(currentPrices).length} stocks`);
            
            // After loading prices, detect accumulation patterns
            detectAccumulationPatterns();
            showLoading(false);
            return currentPrices;
        } else {
            // If no stored prices, fallback to API
            console.warn('No stored prices found in localStorage. Using API fallback.');
            return fetchCurrentPricesFromAPI();
        }
    } catch (error) {
        console.error('Error loading current prices:', error);
        showError('Failed to load current prices: ' + error.message);
        showLoading(false);
        return {};
    }
}

async function fetchCurrentPricesFromAPI() {
    try {
        showLoading(true);
        
        // First try to use the API
        try {
            const response = await fetch('/api/prices');
            if (response.ok) {
                const prices = await response.json();
                
                // Store prices for other pages to use
                localStorage.setItem('currentPrices', JSON.stringify(prices));
                
                // Update current prices
                currentPrices = prices;
                console.log(`Loaded current prices for ${Object.keys(prices).length} stocks`);
                
                // After loading prices, detect accumulation patterns
                detectAccumulationPatterns();
                showLoading(false);
                return prices;
            }
        } catch (e) {
            console.warn('API prices fetch failed, trying historical data');
        }
        
        // If API fails, try to use the local data
        const historicalResponse = await fetch('/organized_nepse_data.json');
        if (historicalResponse.ok) {
            const historicalData = await historicalResponse.json();
            
            // Extract the most recent price for each symbol
            const latestPrices = {};
            const symbolsMap = {};
            
            historicalData.forEach(item => {
                const symbol = item.symbol;
                if (!symbolsMap[symbol] || new Date(item.date) > new Date(symbolsMap[symbol].date)) {
                    symbolsMap[symbol] = item;
                }
            });
            
            // Extract the close price from the most recent data point
            Object.keys(symbolsMap).forEach(symbol => {
                latestPrices[symbol] = parseFloat(symbolsMap[symbol].close);
            });
            
            // Store in localStorage for other components
            localStorage.setItem('currentPrices', JSON.stringify(latestPrices));
            
            // Update current prices
            currentPrices = latestPrices;
            console.log(`Loaded current prices for ${Object.keys(latestPrices).length} stocks from historical data`);
            
            // After loading prices, detect accumulation patterns
            detectAccumulationPatterns();
            showLoading(false);
            return latestPrices;
        }
        
        throw new Error('Failed to load current prices from API or historical data');
    } catch (error) {
        console.error('Error fetching current prices:', error);
        showError('Failed to load current prices: ' + error.message);
        showLoading(false);
        
        // Use mock data for testing as last resort
        useMockDataForTesting();
        return {};
    }
}

async function fetchHistoricalData() {
    try {
        showLoading(true);
        console.log("Fetching historical data...");
        const response = await fetch('/organized_nepse_data.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Historical data fetched:", data ? data.length : 0, "entries");
        console.log("Sample data:", data.slice(0, 3));
        
        // Process the data
        processHistoricalData(data);
        
        console.log(`Processed historical data for ${Object.keys(stockHistoricalData).length} symbols`);
        
        // After processing, detect accumulation patterns
        detectAccumulationPatterns();
        
        showLoading(false);
    } catch (error) {
        console.error('Error fetching historical data:', error);
        showError('Failed to load historical price data: ' + error.message);
        showLoading(false);
        
        // Try using mock data for testing
        useMockDataForTesting();
    }
}

function processHistoricalData(data) {
    stockHistoricalData = {};
    
    // Check if data is an array
    if (!Array.isArray(data)) {
        console.error("Data is not an array:", data);
        return;
    }
    
    // First, extract all unique symbols from the data
    const allSymbols = new Set();
    data.forEach(item => {
        if (item.symbol) {
            allSymbols.add(item.symbol);
        }
    });
    
    // Get user stocks symbols - ensure we have these even if they have no data yet
    userStocks.forEach(stock => {
        if (stock.symbol) {
            allSymbols.add(stock.symbol);
        }
    });
    
    console.log(`Processing historical data for ${allSymbols.size} unique symbols`);
    
    // Group data by symbol
    data.forEach(item => {
        const symbol = item.symbol;
        
        if (!symbol || 
            item.open === undefined || 
            item.high === undefined || 
            item.low === undefined || 
            item.close === undefined || 
            item.volume === undefined) {
            return;
        }
        
        // Check if we have a date field in the expected format
        if (!item.time && !item.date) {
            return;
        }
        
        // Parse all values to ensure they're numbers
        const open = parseFloat(item.open);
        const high = parseFloat(item.high);
        const low = parseFloat(item.low);
        const close = parseFloat(item.close);
        const volume = parseFloat(item.volume);
        
        // Skip invalid data points
        if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close) || isNaN(volume)) {
            return;
        }
        
        // Initialize array for this symbol if needed
        if (!stockHistoricalData[symbol]) {
            stockHistoricalData[symbol] = [];
        }
        
        // Get the date from either time or date field
        let dateValue;
        if (item.date) {
            dateValue = new Date(item.date);
        } else if (item.time) {
            // Format is YYYY_MM_DD
            const dateParts = item.time.split('_');
            if (dateParts.length === 3) {
                const year = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]) - 1; // JavaScript months are 0-based
                const day = parseInt(dateParts[2]);
                dateValue = new Date(year, month, day);
            } else {
                // Try parsing as-is
                dateValue = new Date(item.time);
            }
        }
        
        // Skip if we couldn't parse the date
        if (!dateValue || isNaN(dateValue.getTime())) {
            return;
        }
        
        // Add the data point with date converted to a Date object
        stockHistoricalData[symbol].push({
            date: dateValue,
            open: open,
            high: high,
            low: low,
            close: close,
            volume: volume
        });
    });
    
    // Only process user stocks that have data
    const processedSymbols = [];
    
    // Sort data by date (oldest to newest) and calculate indicators
    Object.keys(stockHistoricalData).forEach(symbol => {
        // Skip if empty
        if (!stockHistoricalData[symbol] || stockHistoricalData[symbol].length === 0) {
            return;
        }
        
        // Sort chronologically
        stockHistoricalData[symbol].sort((a, b) => a.date - b.date);
        
        // Skip if not enough data points for meaningful analysis
        if (stockHistoricalData[symbol].length < MIN_DATA_POINTS) {
            console.log(`Skipping ${symbol} - insufficient data points (${stockHistoricalData[symbol].length})`);
            return;
        }
        
        // Calculate technical indicators
        try {
            calculateIndicators(stockHistoricalData[symbol]);
            processedSymbols.push(symbol);
        } catch (error) {
            console.error(`Error calculating indicators for ${symbol}:`, error);
            // Remove data for this symbol to prevent issues
            delete stockHistoricalData[symbol];
        }
    });
    
    console.log(`Calculated indicators for ${processedSymbols.length} symbols`);
    
    // If the page is in development/test mode and no data is available, generate mock data
    if (processedSymbols.length === 0) {
        console.warn("No historical data processed, using mock data for testing");
        useMockDataForTesting();
    }
}

function calculateIndicators(data) {
    if (!data || data.length < MIN_DATA_POINTS) return;
    
    // Calculate OBV (On-Balance Volume)
    let obv = 0;
    data[0].obv = 0;
    
    console.log("Starting OBV calculation for data with length:", data.length);
    console.log("Initial volume sample:", data.slice(0, 3).map(d => d.volume));
    
    for (let i = 1; i < data.length; i++) {
        // Skip if volume is invalid or missing
        if (data[i].volume === undefined || isNaN(data[i].volume) || 
            data[i-1].close === undefined || isNaN(data[i-1].close) ||
            data[i].close === undefined || isNaN(data[i].close)) {
            // Propagate the previous OBV value if available
            data[i].obv = i > 0 ? data[i-1].obv : 0;
            continue;
        }
        
        // Ensure volume is a positive number
        const volume = Math.max(0, data[i].volume);
        
        if (data[i].close > data[i-1].close) {
            obv += volume;
        } else if (data[i].close < data[i-1].close) {
            obv -= volume;
        }
        // If prices are equal, OBV doesn't change
        
        data[i].obv = obv;
    }
    
    console.log("Final OBV values sample:", data.slice(-3).map(d => d.obv));
    
    // Calculate VWAP (Volume-Weighted Average Price)
    let cumulativeTPV = 0; // Typical Price × Volume
    let cumulativeVolume = 0;
    
    for (let i = 0; i < data.length; i++) {
        const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
        cumulativeTPV += typicalPrice * data[i].volume;
        cumulativeVolume += data[i].volume;
        data[i].vwap = cumulativeTPV / cumulativeVolume;
    }
    
    // Calculate RSI (Relative Strength Index) with default period 14
    calculateRSI(data, 14);
    
    // Calculate moving averages
    calculateMovingAverages(data);
    
    // Calculate volume metrics
    calculateVolumeMetrics(data);
    
    // Calculate price ranges for consolidation detection
    calculatePriceRanges(data);
    
    // Detect consolidation phases
    detectConsolidationPhases(data);
}

function calculateRSI(data, period = 14) {
    if (!data || data.length < period + 1) return;
    
    // Calculate price changes
    const priceChanges = [];
    for (let i = 1; i < data.length; i++) {
        priceChanges.push(data[i].close - data[i-1].close);
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
    
    // Assign RSI values to data points
    for (let i = 0; i < rsi.length; i++) {
        data[i + period].rsi = parseFloat(rsi[i].toFixed(2));
    }
}

function calculateMovingAverages(data) {
    const periods = [20, 50, 200]; // Common moving average periods
    
    periods.forEach(period => {
        if (data.length < period) return;
        
        // Calculate simple moving average (SMA)
        for (let i = period - 1; i < data.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j].close;
            }
            data[i][`sma${period}`] = sum / period;
        }
        
        // Calculate exponential moving average (EMA)
        const multiplier = 2 / (period + 1);
        
        // Initialize EMA with SMA
        data[period - 1][`ema${period}`] = data[period - 1][`sma${period}`];
        
        // Calculate EMA for remaining data points
        for (let i = period; i < data.length; i++) {
            data[i][`ema${period}`] = (data[i].close - data[i-1][`ema${period}`]) * multiplier + data[i-1][`ema${period}`];
        }
    });
}

function calculateVolumeMetrics(data) {
    const volumePeriod = 20;
    
    // Skip if not enough data
    if (data.length < volumePeriod) return;
    
    // Calculate volume moving average and relative volume
    for (let i = volumePeriod - 1; i < data.length; i++) {
        let sumVolume = 0;
        for (let j = 0; j < volumePeriod; j++) {
            sumVolume += data[i - j].volume;
        }
        data[i].avgVolume = sumVolume / volumePeriod;
        data[i].relativeVolume = data[i].volume / data[i].avgVolume;
        
        // Detect volume anomalies
        data[i].isVolumeAnomaly = data[i].relativeVolume >= VOLUME_ANOMALY_THRESHOLD;
    }
    
    // Detect volume patterns like climax and absorption
    for (let i = 10; i < data.length; i++) {
        // Volume climax: high volume with price movement
        const priceChange = Math.abs((data[i].close - data[i-1].close) / data[i-1].close);
        data[i].isVolumeClimax = data[i].isVolumeAnomaly && priceChange > 0.02;
        
        // Absorption: high volume with little price movement
        data[i].isAbsorption = data[i].isVolumeAnomaly && priceChange < 0.01;
        
        // Check for effort vs. result anomaly (high volume but price doesn't follow)
        if (i >= 5) {
            const volumeIncrease = data[i].volume / data[i-5].volume;
            const priceMove = Math.abs(data[i].close - data[i-5].close);
            data[i].isEffortVsResult = volumeIncrease > 2 && priceMove < data[i-5].close * 0.01;
        }
    }
}

function calculatePriceRanges(data) {
    // Calculate various price ranges for accumulation detection
    const windows = [10, 20, 50];
    
    windows.forEach(window => {
        if (data.length < window) return;
        
        for (let i = window - 1; i < data.length; i++) {
            let highestHigh = -Infinity;
            let lowestLow = Infinity;
            
            // Find highest high and lowest low in the window
            for (let j = 0; j < window; j++) {
                const candle = data[i - j];
                highestHigh = Math.max(highestHigh, candle.high);
                lowestLow = Math.min(lowestLow, candle.low);
            }
            
            // Calculate range metrics
            data[i][`highestHigh${window}`] = highestHigh;
            data[i][`lowestLow${window}`] = lowestLow;
            data[i][`priceRange${window}`] = highestHigh - lowestLow;
            data[i][`rangePercent${window}`] = ((highestHigh - lowestLow) / lowestLow) * 100;
        }
    });
}

function detectConsolidationPhases(data) {
    if (data.length < 50) return;
    
    // Define threshold for consolidation (percentage range)
    const consolidationThreshold = PRICE_CONSOLIDATION_THRESHOLD * 100; // Convert to percentage
    
    // Check for consolidation over different windows
    const windows = [20, 30];
    
    windows.forEach(window => {
        if (data.length < window) return;
        
        // Detect consolidation phases
        for (let i = window - 1; i < data.length; i++) {
            // Calculate price range as a percentage of lowest price in the window
            const rangePercent = data[i][`rangePercent${window}`];
            
            // Mark as consolidation if range percentage is below threshold
            data[i][`isConsolidation${window}`] = rangePercent < consolidationThreshold;
            
            // Detect if price is in lower half of range
            if (data[i][`isConsolidation${window}`]) {
                const midPoint = (data[i][`highestHigh${window}`] + data[i][`lowestLow${window}`]) / 2;
                data[i][`isLowerHalf${window}`] = data[i].close < midPoint;
            }
        }
    });
    
    // Detect springs (price briefly going below support then recovering)
    for (let i = 30; i < data.length; i++) {
        // Check for a consolidation phase in the last 30 days
        if (data[i].isConsolidation20 || data[i].isConsolidation30) {
            const lowestLow = Math.min(data[i].lowestLow20 || Infinity, data[i].lowestLow30 || Infinity);
            
            // Check for a spring pattern
            if (i >= 5) {
                // Spring condition: price dropped below prior low then recovered
                const droppedBelow = Math.min(data[i-5].low, data[i-4].low, data[i-3].low) < lowestLow * (1 - SPRING_THRESHOLD);
                const recovered = data[i].close > lowestLow;
                
                data[i].isSpring = droppedBelow && recovered;
            }
        }
    }
}

// Use mock data for testing when historical data can't be loaded
function useMockDataForTesting() {
    // Create some sample data for testing
    const mockStocks = ['ADBL', 'NABIL', 'UPPER', 'NHPC', 'NTC'];
    stockHistoricalData = {};
    
    mockStocks.forEach(symbol => {
        const data = [];
        const basePrice = 400 + Math.random() * 200;
        let price = basePrice;
        let volume = 1000 + Math.random() * 1000;
        let obv = 0;
        
        // Generate 180 days of data
        for (let i = 0; i < 180; i++) {
            // Random price movement
            const change = (Math.random() - 0.48) * 10; // Slightly biased upward
            price += change;
            
            // Random volume, with occasional spikes
            let dailyVolume = volume * (0.7 + Math.random() * 0.6);
            if (i % 15 === 0) { // Volume spike every 15 days
                dailyVolume *= 3;
            }
            
            // Update OBV
            if (change > 0) {
                obv += dailyVolume;
            } else if (change < 0) {
                obv -= dailyVolume;
            }
            
            // Simulation values to create accumulation patterns for testing
            let isAccumulation = false;
            if (i > 80 && i < 120) {
                // Simulate accumulation in days 80-120
                price = basePrice * (0.95 + (Math.random() * 0.1)); // Keep price in a range
                isAccumulation = true;
                
                // Higher volume on down days for accumulation
                if (change < 0) {
                    dailyVolume *= 1.5; // More volume on down days
                }
            }
            
            // Create data point
            data.push({
                date: new Date(2023, 0, i + 1),
                open: price - Math.random() * 5,
                high: price + Math.random() * 8,
                low: price - Math.random() * 8,
                close: price,
                volume: dailyVolume,
                obv: obv,
                isAccumulation: isAccumulation
            });
        }
        
        // Calculate indicators for the mock data
        calculateIndicators(data);
        
        // Store mock data
        stockHistoricalData[symbol] = data;
    });
    
    // Create mock user stocks for testing
    userStocks = mockStocks.map(symbol => ({ symbol }));
    
    // Create mock current prices
    currentPrices = {};
    mockStocks.forEach(symbol => {
        const data = stockHistoricalData[symbol];
        currentPrices[symbol] = data[data.length - 1].close;
    });
    
    // Detect accumulation with mock data
    detectAccumulationPatterns();
    
    showSuccess('Using test data for demonstration');
}

function detectAccumulationPatterns() {
    // Clear existing results
    accumulationStocks = [];
    
    // Get filter settings
    const sensitivityLevel = parseInt(document.getElementById('sensitivitySlider').value) || 5;
    const timeframeDays = parseInt(document.getElementById('timeframeSelect').value) || 60;
    const minConfidence = document.getElementById('minConfidenceSelect').value || 'medium';
    const useWyckoff = document.getElementById('patternWyckoff').checked;
    const useVSA = document.getElementById('patternVSA').checked;
    const useOBV = document.getElementById('patternOBV').checked;
    const useRSI = document.getElementById('patternRSI').checked;
    const useMultiTimeframe = document.getElementById('multiTimeframeToggle').checked;
    const rsiPeriod = parseInt(document.getElementById('rsiPeriod').value) || 14;
    const obvSensitivity = parseInt(document.getElementById('obvSensitivity').value) || 5;
    
    // Log the timeframe settings for better understanding
    console.log(`Analysis timeframe set to: ${timeframeDays} days`);
    
    // Set dynamic thresholds based on sensitivity
    const thresholds = {
        consolidation: 0.15 - (sensitivityLevel * 0.01), // 0.05 to 0.15 range
        obvDrift: 0.2 - (sensitivityLevel * 0.015),      // 0.05 to 0.2 range
        rsiDivergence: 0.15 - (sensitivityLevel * 0.01), // 0.05 to 0.15 range
        volumeAnomaly: 2.0 + (sensitivityLevel * 0.2),   // 2.0 to 4.0 range
        scoringThreshold: {
            low: 10,
            medium: 20,
            high: 30,
            veryhigh: 40
        }
    };
    
    // If no user stocks are available, load them first
    if (userStocks.length === 0) {
        loadUserStocks();
    }
    
    // If no current prices are available, try to use localStorage
    if (Object.keys(currentPrices).length === 0) {
        const storedPrices = localStorage.getItem('currentPrices');
        if (storedPrices) {
            try {
                currentPrices = JSON.parse(storedPrices);
            } catch (e) {
                console.error("Error parsing stored prices:", e);
            }
        }
    }
    
    // Keep track of how many stocks were analyzed
    let analyzedCount = 0;
    let attemptedCount = 0;
    
    console.log(`Starting analysis with ${userStocks.length} user stocks and ${Object.keys(stockHistoricalData).length} historical data entries`);
    
    // Analyze each user stock
    userStocks.forEach(stock => {
        // Skip if stock is not an object or doesn't have a symbol
        if (!stock || typeof stock !== 'object' || !stock.symbol) {
            return;
        }
        
        const symbol = stock.symbol;
        attemptedCount++;
        
        try {
            // Skip if no data or current price
            if (!stockHistoricalData[symbol]) {
                console.log(`No historical data for ${symbol}`);
                return;
            }
            
            if (!currentPrices[symbol]) {
                console.log(`No current price for ${symbol}`);
                return;
            }
            
            const data = stockHistoricalData[symbol];
            const currentPrice = parseFloat(currentPrices[symbol]);
            
            // Skip if invalid current price
            if (isNaN(currentPrice) || currentPrice <= 0) {
                console.log(`Invalid current price for ${symbol}: ${currentPrices[symbol]}`);
                return;
            }
            
            // Skip if not enough data points
            if (!data || data.length < MIN_DATA_POINTS) {
                console.log(`Insufficient data points for ${symbol}: ${data ? data.length : 0}`);
                return;
            }
            
            // Log how much historical data is available for this stock
            if (data.length >= timeframeDays) {
                console.log(`Analyzing ${symbol} with ${data.length} days of data, using last ${timeframeDays} days for analysis`);
            } else {
                console.log(`Analyzing ${symbol} with all available ${data.length} days of data (less than requested ${timeframeDays} days)`);
            }
            
            analyzedCount++;
            
            // Configure detection options
            const options = {
                timeframeDays,
                sensitivityLevel,
                useWyckoff,
                useVSA,
                useOBV,
                useRSI,
                useMultiTimeframe,
                rsiPeriod,
                obvSensitivity,
                thresholds
            };
            
            // Analyze the stock for accumulation patterns
            const analysis = analyzeAccumulationPatterns(symbol, data, currentPrice, options);
            
            // If score is above minimum confidence threshold, add to results
            if (analysis.score >= thresholds.scoringThreshold[minConfidence]) {
                // Check if this is newly identified
                const isNew = isNewlyIdentified(symbol, analysis.patterns);
                
                // Add to accumulation stocks
                accumulationStocks.push({
                    ...analysis,
                    isNew
                });
            }
        } catch (error) {
            console.error(`Error analyzing ${symbol}:`, error);
        }
    });
    
    // Sort by score (descending)
    accumulationStocks.sort((a, b) => b.score - a.score);
    
    // Display results
    displayAccumulationStocks();
    
    console.log(`Attempted ${attemptedCount} stocks, analyzed ${analyzedCount} and detected ${accumulationStocks.length} with accumulation patterns`);
    
    // If no stocks were detected, try using mock data for demonstration
    if (accumulationStocks.length === 0 && analyzedCount === 0) {
        useMockDataForTesting();
    }
}

function analyzeAccumulationPatterns(symbol, data, currentPrice, options) {
    // Initialize results object
    const result = {
        symbol,
        price: currentPrice,
        score: 0,
        confidence: 'low',
        patterns: [],
        volumeSignature: null,
        daysInAccumulation: 0,
        details: {}
    };
    
    // Get relevant data timeframe (most recent X days)
    // Make sure we use all available data if a long timeframe is selected
    // or if the data array is shorter than the requested timeframe
    const dataToUse = Math.min(data.length, options.timeframeDays);
    const relevantData = data.slice(-dataToUse);
    
    // Skip if not enough data in timeframe
    if (relevantData.length < 20) {
        return result;
    }
    
    // Perform different pattern detection methods based on options
    
    // 1. Wyckoff Accumulation Pattern Detection
    if (options.useWyckoff) {
        const wyckoffResult = detectWyckoffAccumulation(relevantData, options);
        
        if (wyckoffResult.detected) {
            result.patterns.push('wyckoff');
            result.score += wyckoffResult.score;
            result.details.wyckoff = wyckoffResult;
            
            // Update days in accumulation if it's the longest
            result.daysInAccumulation = Math.max(result.daysInAccumulation, wyckoffResult.daysInPhase);
        }
    }
    
    // 2. Volume Spread Analysis (VSA)
    if (options.useVSA) {
        const vsaResult = detectVSAPatterns(relevantData, options);
        
        if (vsaResult.detected) {
            result.patterns.push('vsa');
            result.score += vsaResult.score;
            result.details.vsa = vsaResult;
            result.volumeSignature = vsaResult.signature;
            
            // Update days in accumulation if it's the longest
            result.daysInAccumulation = Math.max(result.daysInAccumulation, vsaResult.daysDetected);
        }
    }
    
    // 3. OBV Trend Analysis
    if (options.useOBV) {
        const obvResult = detectOBVAccumulation(relevantData, options);
        
        if (obvResult.detected) {
            result.patterns.push('obv');
            result.score += obvResult.score;
            result.details.obv = obvResult;
            
            // Update days in accumulation if it's the longest
            result.daysInAccumulation = Math.max(result.daysInAccumulation, obvResult.daysDetected);
        }
    }
    
    // 4. RSI Divergence Detection
    if (options.useRSI) {
        const rsiResult = detectRSIDivergence(relevantData, options);
        
        if (rsiResult.detected) {
            result.patterns.push('rsi');
            result.score += rsiResult.score;
            result.details.rsi = rsiResult;
        }
    }
    
    // 5. Multi-timeframe Confirmation (if enabled)
    if (options.useMultiTimeframe && result.patterns.length > 0) {
        // Check weekly timeframe (generate weekly candles from daily)
        const weeklyData = createWeeklyData(data);
        
        if (weeklyData.length >= 10) {
            const weeklyOptions = { ...options, timeframeDays: Math.min(52, weeklyData.length) };
            let weeklyConfirmations = 0;
            
            // Run the same detection methods on weekly data
            if (options.useWyckoff) {
                const wyckoffWeekly = detectWyckoffAccumulation(weeklyData, weeklyOptions);
                if (wyckoffWeekly.detected) weeklyConfirmations++;
            }
            
            if (options.useVSA) {
                const vsaWeekly = detectVSAPatterns(weeklyData, weeklyOptions);
                if (vsaWeekly.detected) weeklyConfirmations++;
            }
            
            if (options.useOBV) {
                const obvWeekly = detectOBVAccumulation(weeklyData, weeklyOptions);
                if (obvWeekly.detected) weeklyConfirmations++;
            }
            
            // Add bonus points for weekly timeframe confirmations
            if (weeklyConfirmations > 0) {
                result.score += weeklyConfirmations * 5;
                result.details.weeklyConfirmations = weeklyConfirmations;
            }
        }
    }
    
    // Calculate final confidence level based on score
    if (result.score >= options.thresholds.scoringThreshold.veryhigh) {
        result.confidence = 'veryhigh';
    } else if (result.score >= options.thresholds.scoringThreshold.high) {
        result.confidence = 'high';
    } else if (result.score >= options.thresholds.scoringThreshold.medium) {
        result.confidence = 'medium';
    } else {
        result.confidence = 'low';
    }
    
    // Calculate last confirmation date
    const lastDay = relevantData[relevantData.length - 1];
    result.lastConfirmationDate = lastDay.date;
    
    return result;
}

// Helper function to generate weekly data from daily
function createWeeklyData(dailyData) {
    if (!dailyData || dailyData.length < 7) return [];
    
    const weeklyData = [];
    let currentWeekData = [];
    let currentWeekDay = -1;
    
    // Process daily data to create weekly candles
    dailyData.forEach(day => {
        const dayOfWeek = day.date.getDay();
        
        // If we're in a new week
        if (currentWeekDay === -1 || dayOfWeek <= currentWeekDay) {
            // Save the previous week if we have data
            if (currentWeekData.length > 0) {
                const weekCandle = createCandleFromRange(currentWeekData);
                weeklyData.push(weekCandle);
            }
            
            // Start a new week
            currentWeekData = [day];
        } else {
            // Add to current week
            currentWeekData.push(day);
        }
        
        currentWeekDay = dayOfWeek;
    });
    
    // Add the last week if we have data
    if (currentWeekData.length > 0) {
        const weekCandle = createCandleFromRange(currentWeekData);
        weeklyData.push(weekCandle);
    }
    
    return weeklyData;
}

// Helper function to create a candle from a range of candles
function createCandleFromRange(candles) {
    if (!candles || candles.length === 0) return null;
    
    const firstCandle = candles[0];
    const lastCandle = candles[candles.length - 1];
    
    // Calculate OHLC values
    const open = firstCandle.open;
    const close = lastCandle.close;
    
    let high = -Infinity;
    let low = Infinity;
    let totalVolume = 0;
    
    // Find highest high and lowest low in the range
    candles.forEach(candle => {
        high = Math.max(high, candle.high);
        low = Math.min(low, candle.low);
        totalVolume += candle.volume || 0;
    });
    
    // Create and return the aggregated candle
    return {
        date: firstCandle.date,
        open,
        high,
        low,
        close,
        volume: totalVolume
    };
}

// Check if a stock is newly identified with accumulation patterns
function isNewlyIdentified(symbol, patterns) {
    const now = new Date();
    const historyKey = `${symbol}_accumulation`;
    
    // If no patterns found, not new
    if (!patterns || patterns.length === 0) {
        return false;
    }
    
    // Check if this stock is in accumulation history
    if (!accumulationStocksHistory[historyKey]) {
        // First time seeing this stock in accumulation
        accumulationStocksHistory[historyKey] = {
            firstDetected: now.toISOString(),
            patterns
        };
        
        // Save to localStorage
        localStorage.setItem('accumulationStocksHistory', JSON.stringify(accumulationStocksHistory));
        return true;
    } else {
        // Check if it's been less than 7 days since first detection
        const firstDetected = new Date(accumulationStocksHistory[historyKey].firstDetected);
        const diffTime = Math.abs(now - firstDetected);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Update patterns if necessary
        if (JSON.stringify(patterns) !== JSON.stringify(accumulationStocksHistory[historyKey].patterns)) {
            accumulationStocksHistory[historyKey].patterns = patterns;
            localStorage.setItem('accumulationStocksHistory', JSON.stringify(accumulationStocksHistory));
        }
        
        return diffDays <= 7; // Show as new for 7 days
    }
}

// Function to filter displayed stocks based on search
function filterDisplayedStocks(searchTerm) {
    // Check if the table exists
    if (!accumulationStocksTable) {
        accumulationStocksTable = document.querySelector('#accumulationTable tbody');
        if (!accumulationStocksTable) {
            console.error('Cannot filter stocks: Table not found');
            return;
        }
    }
    
    const rows = accumulationStocksTable.querySelectorAll('tr');
    
    // If no rows, nothing to filter
    if (!rows || rows.length === 0) {
        return;
    }
    
    rows.forEach(row => {
        const symbolCell = row.querySelector('td:first-child');
        if (!symbolCell) return;
        
        const symbol = symbolCell.textContent;
        if (searchTerm === '' || symbol.toLowerCase().includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function detectWyckoffAccumulation(data, options) {
    // Initialize result object
    const result = {
        detected: false,
        score: 0,
        phase: null,
        daysInPhase: 0,
        events: [],
        keyLevels: {}
    };
    
    // Need at least 30 data points for reliable detection
    if (data.length < 30) {
        return result;
    }
    
    // Extract data points based on timeframe 
    // Use the full dataset if the specified timeframe is larger
    const analyzePeriod = Math.min(data.length, options.timeframeDays);
    const relevantData = data.slice(-analyzePeriod);
    
    // Step 1: Identify potential trading range (TR)
    const tradingRange = identifyTradingRange(relevantData);
    
    if (!tradingRange.isValid) {
        return result;
    }
    
    // Store key levels
    result.keyLevels = {
        resistanceLevel: tradingRange.resistanceLevel,
        supportLevel: tradingRange.supportLevel,
        midPoint: tradingRange.midPoint
    };
    
    // Step 2: Identify potential phases
    const phaseData = identifyWyckoffPhases(relevantData, tradingRange);
    
    if (phaseData.currentPhase) {
        result.phase = phaseData.currentPhase;
        result.daysInPhase = phaseData.daysInCurrentPhase;
        result.events = phaseData.events;
        
        // Add points based on phase
        if (phaseData.currentPhase === 'PhaseA') {
            result.score += 5; // Phase A (Beginning of accumulation)
            result.detected = true;
        } else if (phaseData.currentPhase === 'PhaseB') {
            result.score += 10; // Phase B (Building cause)
            result.detected = true;
        } else if (phaseData.currentPhase === 'PhaseC') {
            result.score += 15; // Phase C (Test of support)
            result.detected = true;
        } else if (phaseData.currentPhase === 'PhaseD') {
            result.score += 20; // Phase D (Last point of support)
            result.detected = true;
        } else if (phaseData.currentPhase === 'PhaseE') {
            result.score += 15; // Phase E (Markup)
            result.detected = true;
        }
    }
    
    // Step 3: Look for specific Wyckoff signatures
    
    // Check for Spring pattern (price briefly goes below support then recovers)
    const springFound = detectSpringPattern(relevantData, tradingRange.supportLevel);
    if (springFound.detected) {
        result.events.push({
            type: 'Spring', 
            day: springFound.dayIndex,
            date: springFound.date
        });
        result.score += 15; // Springs are strong accumulation signals
        result.detected = true;
    }
    
    // Check for Sign of Strength (SOS) after spring
    const sosFound = detectSignOfStrength(relevantData, tradingRange);
    if (sosFound.detected) {
        result.events.push({
            type: 'SOS', 
            day: sosFound.dayIndex,
            date: sosFound.date
        });
        result.score += 10;
        result.detected = true;
    }
    
    // Check for Tests (price comes back to test support after SOS)
    const testFound = detectTestPattern(relevantData, tradingRange);
    if (testFound.detected) {
        result.events.push({
            type: 'Test', 
            day: testFound.dayIndex,
            date: testFound.date
        });
        result.score += 8;
        result.detected = true;
    }
    
    // Check for Backup (price falls back to previous resistance turned support)
    const backupFound = detectBackup(relevantData, tradingRange);
    if (backupFound.detected) {
        result.events.push({
            type: 'Backup', 
            day: backupFound.dayIndex,
            date: backupFound.date
        });
        result.score += 5;
        result.detected = true;
    }
    
    // If accumulation has been detected, ensure a minimum score
    if (result.detected && result.score < 5) {
        result.score = 5;
    }
    
    return result;
}

function identifyTradingRange(data) {
    // Initialize result
    const result = {
        isValid: false,
        resistanceLevel: 0,
        supportLevel: 0,
        midPoint: 0,
        rangePercent: 0,
        daysInRange: 0
    };
    
    // Check if there's enough data
    if (data.length < 20) {
        return result;
    }
    
    // Find local highs and lows
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    
    // Use the most recent 80% of data to identify range
    const startIndex = Math.floor(data.length * 0.2);
    const rangeData = data.slice(startIndex);
    
    // Find extreme points
    rangeData.forEach(candle => {
        highestHigh = Math.max(highestHigh, candle.high);
        lowestLow = Math.min(lowestLow, candle.low);
    });
    
    // Calculate range percentage
    const rangePercent = ((highestHigh - lowestLow) / lowestLow) * 100;
    
    // Count how many days stayed within this range
    let daysInRange = 0;
    let consecutiveDaysInRange = 0;
    let maxConsecutiveDays = 0;
    
    rangeData.forEach(candle => {
        // If price is within 90% of the range
        if (candle.low > lowestLow * 0.97 && candle.high < highestHigh * 1.03) {
            daysInRange++;
            consecutiveDaysInRange++;
            maxConsecutiveDays = Math.max(maxConsecutiveDays, consecutiveDaysInRange);
        } else {
            consecutiveDaysInRange = 0;
        }
    });
    
    // For a valid trading range:
    // 1. Range should be relatively tight (10-20% for accumulation)
    // 2. Price should stay in range for at least 60% of the period
    // 3. Should have at least 5 consecutive days in range
    const isValidRange = rangePercent <= 20 && 
                         daysInRange >= rangeData.length * 0.6 &&
                         maxConsecutiveDays >= 5;
    
    if (isValidRange) {
        result.isValid = true;
        result.resistanceLevel = highestHigh;
        result.supportLevel = lowestLow;
        result.midPoint = (highestHigh + lowestLow) / 2;
        result.rangePercent = rangePercent;
        result.daysInRange = daysInRange;
    }
    
    return result;
}

function identifyWyckoffPhases(data, tradingRange) {
    // Initialize result
    const result = {
        currentPhase: null,
        previousPhase: null,
        daysInCurrentPhase: 0,
        events: []
    };
    
    // Need enough data to identify phases
    if (data.length < 20 || !tradingRange.isValid) {
        return result;
    }
    
    // Get support and resistance levels
    const { supportLevel, resistanceLevel, midPoint } = tradingRange;
    
    // Scanning variables
    let currentPhase = null;
    let phaseStartIndex = 0;
    let preliminarySupportFound = false;
    let sellingClimaxFound = false;
    let secondaryTestFound = false;
    let springFound = false;
    let signOfStrengthFound = false;
    let lastPointOfSupportFound = false;
    let signOfWeaknessFound = false;
    
    // Scan for phases
    for (let i = 20; i < data.length; i++) {
        const currentCandle = data[i];
        const previousCandles = data.slice(i - 10, i);
        
        // Phase A detection (Preliminary Support, Selling Climax, Secondary Test)
        if (!preliminarySupportFound && currentCandle.low < supportLevel * 1.05 && 
            currentCandle.volume > currentCandle.avgVolume * 1.5) {
            preliminarySupportFound = true;
            result.events.push({
                type: 'Preliminary Support',
                day: i,
                date: currentCandle.date
            });
            currentPhase = 'PhaseA';
            phaseStartIndex = i;
        }
        
        if (preliminarySupportFound && !sellingClimaxFound && 
            currentCandle.low <= Math.min(...previousCandles.map(c => c.low)) &&
            currentCandle.volume > currentCandle.avgVolume * 2) {
            sellingClimaxFound = true;
            result.events.push({
                type: 'Selling Climax',
                day: i,
                date: currentCandle.date
            });
            currentPhase = 'PhaseA';
            if (phaseStartIndex === 0) phaseStartIndex = i;
        }
        
        if (sellingClimaxFound && !secondaryTestFound && 
            currentCandle.low > supportLevel * 0.95 && currentCandle.low < supportLevel * 1.05) {
            secondaryTestFound = true;
            result.events.push({
                type: 'Secondary Test',
                day: i,
                date: currentCandle.date
            });
            currentPhase = 'PhaseA';
            if (phaseStartIndex === 0) phaseStartIndex = i;
        }
        
        // Phase B detection (Consolidation, Testing)
        if (secondaryTestFound && 
            currentCandle.low > supportLevel * 0.97 && currentCandle.high < resistanceLevel * 1.03) {
            if (currentPhase === 'PhaseA' || currentPhase === null) {
                currentPhase = 'PhaseB';
                if (phaseStartIndex === 0) phaseStartIndex = i;
                result.events.push({
                    type: 'Start of Phase B',
                    day: i,
                    date: currentCandle.date
                });
            }
        }
        
        // Phase C detection (Spring)
        if (currentPhase === 'PhaseB' && !springFound && 
            currentCandle.low < supportLevel * 0.98 && currentCandle.close > supportLevel) {
            springFound = true;
            result.events.push({
                type: 'Spring',
                day: i,
                date: currentCandle.date
            });
            currentPhase = 'PhaseC';
            phaseStartIndex = i;
        }
        
        // Phase D detection (SOS, LPS)
        if (springFound && !signOfStrengthFound && 
            currentCandle.close > currentCandle.open && 
            currentCandle.volume > currentCandle.avgVolume * 1.5) {
            signOfStrengthFound = true;
            result.events.push({
                type: 'Sign of Strength',
                day: i,
                date: currentCandle.date
            });
            currentPhase = 'PhaseD';
            phaseStartIndex = i;
        }
        
        if (signOfStrengthFound && !lastPointOfSupportFound && 
            currentCandle.low > supportLevel * 0.98 && currentCandle.low < midPoint) {
            lastPointOfSupportFound = true;
            result.events.push({
                type: 'Last Point of Support',
                day: i,
                date: currentCandle.date
            });
            currentPhase = 'PhaseD';
            if (phaseStartIndex === 0) phaseStartIndex = i;
        }
        
        // Phase E detection (Breakout)
        if (lastPointOfSupportFound && 
            currentCandle.close > resistanceLevel && 
            currentCandle.volume > currentCandle.avgVolume) {
            result.events.push({
                type: 'Breakout',
                day: i,
                date: currentCandle.date
            });
            currentPhase = 'PhaseE';
            phaseStartIndex = i;
        }
        
        // Check for Sign of Weakness (SOW) - potential failure
        if (currentPhase === 'PhaseD' && !signOfWeaknessFound && 
            currentCandle.close < currentCandle.open && 
            currentCandle.volume > currentCandle.avgVolume) {
            signOfWeaknessFound = true;
            result.events.push({
                type: 'Sign of Weakness',
                day: i,
                date: currentCandle.date
            });
        }
    }
    
    // Set result based on detected phase
    result.currentPhase = currentPhase;
    result.daysInCurrentPhase = currentPhase ? data.length - phaseStartIndex : 0;
    
    return result;
}

function detectSpringPattern(data, supportLevel) {
    const result = {
        detected: false,
        dayIndex: -1,
        date: null
    };
    
    if (!data || data.length < 10 || !supportLevel) return result;
    
    // Look for springs in the last 15 days
    for (let i = data.length - 15; i < data.length; i++) {
        if (i < 3) continue; // Need some previous data
        
        const currentDay = data[i];
        const previousDays = data.slice(i - 3, i);
        
        // Spring condition: price drops below support then recovers above it
        if (currentDay.low < supportLevel * 0.97 && // Went below support
            currentDay.close > supportLevel && // Closed above support
            previousDays.some(day => day.close < supportLevel)) { // Was below support recently
            
            result.detected = true;
            result.dayIndex = i;
            result.date = currentDay.date;
            break;
        }
    }
    
    return result;
}

function detectSignOfStrength(data, tradingRange) {
    const result = {
        detected: false,
        dayIndex: -1,
        date: null
    };
    
    if (!data || data.length < 20 || !tradingRange.isValid) return result;
    
    const { midPoint, resistanceLevel } = tradingRange;
    
    // Look for SOS in the last 15 days
    for (let i = data.length - 15; i < data.length; i++) {
        if (i < 5) continue; // Need some previous data
        
        const currentDay = data[i];
        const previousDays = data.slice(i - 5, i);
        
        // SOS condition: strong up move with volume after testing support
        if (currentDay.close > currentDay.open && // Up day
            currentDay.close > midPoint && // Above midpoint of range
            currentDay.close > Math.max(...previousDays.map(d => d.close)) && // Higher than previous days
            currentDay.volume > currentDay.avgVolume * 1.5) { // Above average volume
            
            result.detected = true;
            result.dayIndex = i;
            result.date = currentDay.date;
            break;
        }
    }
    
    return result;
}

function detectTestPattern(data, tradingRange) {
    const result = {
        detected: false,
        dayIndex: -1,
        date: null
    };
    
    if (!data || data.length < 20 || !tradingRange.isValid) return result;
    
    const { supportLevel, midPoint } = tradingRange;
    
    // Look for tests in the last 15 days
    for (let i = data.length - 15; i < data.length; i++) {
        if (i < 8) continue; // Need some previous data
        
        const currentDay = data[i];
        const previousDays = data.slice(i - 8, i);
        
        // Test condition: return to support level after some strength
        if (currentDay.low > supportLevel * 0.97 && // Not breaking support
            currentDay.low < supportLevel * 1.05 && // Near support
            previousDays.some(d => d.close > midPoint) && // Was above midpoint recently
            currentDay.volume < currentDay.avgVolume) { // Lower volume on test
            
            result.detected = true;
            result.dayIndex = i;
            result.date = currentDay.date;
            break;
        }
    }
    
    return result;
}

function detectBackup(data, tradingRange) {
    const result = {
        detected: false,
        dayIndex: -1,
        date: null
    };
    
    if (!data || data.length < 20 || !tradingRange.isValid) return result;
    
    const { resistanceLevel, midPoint } = tradingRange;
    
    // Look for backup in the last 10 days
    for (let i = data.length - 10; i < data.length; i++) {
        if (i < 8) continue; // Need some previous data
        
        const currentDay = data[i];
        const previousDays = data.slice(i - 8, i);
        
        // Backup condition: price pulled back to previous resistance after breaking above it
        if (previousDays.some(d => d.close > resistanceLevel) && // Was above resistance 
            currentDay.low < resistanceLevel * 1.03 && // Pulled back to resistance
            currentDay.low > midPoint && // Still above midpoint
            currentDay.volume < currentDay.avgVolume) { // Lower volume on backup
            
            result.detected = true;
            result.dayIndex = i;
            result.date = currentDay.date;
            break;
        }
    }
    
    return result;
}

function detectVSAPatterns(data, options) {
    // Initialize result
    const result = {
        detected: false,
        score: 0,
        signature: null,
        daysDetected: 0,
        patterns: []
    };
    
    // Need at least 20 data points for reliable VSA
    if (data.length < 20) {
        return result;
    }
    
    // Get sensitivity setting
    const sensitivity = options.sensitivityLevel / 10; // Convert to 0.1-1.0 range
    
    // Counters for detected patterns
    let noSupplyCount = 0;
    let noSupplyDays = [];
    let demandComingInCount = 0;
    let demandComingInDays = [];
    let absorptionVolumeCount = 0;
    let absorptionVolumeDays = [];
    let effortVsResultCount = 0;
    let effortVsResultDays = [];
    let stopVolumeCount = 0;
    let stopVolumeDays = [];
    
    // Detect VSA patterns in the last 30 days or within timeframe
    const scanDays = Math.min(30, data.length - 10);
    const scanStartIndex = data.length - scanDays;
    
    for (let i = scanStartIndex; i < data.length; i++) {
        const candle = data[i];
        
        // Need previous candles for comparison
        if (i < 5) continue;
        
        const prevCandle = data[i - 1];
        const prevCandles5 = data.slice(i - 5, i);
        const avgHeight = calculateAvgCandleHeight(prevCandles5);
        const avgVolume = candle.avgVolume || calculateAvgVolume(prevCandles5);
        
        // 1. No Supply: narrow range, price up, low volume
        // Indicates lack of selling at higher prices
        if (candleHeight(candle) < avgHeight * 0.7 && 
            candle.close > prevCandle.close &&
            candle.volume < avgVolume * 0.8) {
            
            noSupplyCount++;
            noSupplyDays.push(i);
            
            result.patterns.push({
                type: 'No Supply',
                day: i,
                date: candle.date
            });
        }
        
        // 2. Demand Coming In: price up, closing in upper half, increased volume
        // Indicates institutional buying
        if (candle.close > prevCandle.close &&
            isInUpperHalf(candle) &&
            candle.volume > avgVolume * (1.2 + sensitivity * 0.3)) {
            
            demandComingInCount++;
            demandComingInDays.push(i);
            
            result.patterns.push({
                type: 'Demand Coming In',
                day: i,
                date: candle.date
            });
        }
        
        // 3. Absorption Volume: high volume, narrow range or down candle that closes well
        // Indicates big players absorbing supply
        if (candle.volume > avgVolume * (1.5 + sensitivity * 0.5) &&
            (candleHeight(candle) < avgHeight * 0.8 || 
             (candle.close < candle.open && candle.close > (candle.low + (candle.high - candle.low) * 0.4)))) {
            
            absorptionVolumeCount++;
            absorptionVolumeDays.push(i);
            
            result.patterns.push({
                type: 'Absorption Volume',
                day: i,
                date: candle.date
            });
        }
        
        // 4. Effort vs Result: high volume but price doesn't move much (especially on down days)
        // Indicates absorption of selling
        if (candle.volume > avgVolume * (1.8 + sensitivity * 0.4) &&
            Math.abs(candle.close - prevCandle.close) < avgHeight * 0.5) {
            
            effortVsResultCount++;
            effortVsResultDays.push(i);
            
            result.patterns.push({
                type: 'Effort vs Result',
                day: i,
                date: candle.date
            });
        }
        
        // 5. Stopping Volume: down day with high volume that closes well off the lows
        // Indicates buying of the dip
        if (candle.close < prevCandle.close &&
            candle.volume > avgVolume * (1.3 + sensitivity * 0.3) &&
            candle.close > (candle.low + (candle.high - candle.low) * 0.6)) {
            
            stopVolumeCount++;
            stopVolumeDays.push(i);
            
            result.patterns.push({
                type: 'Stopping Volume',
                day: i,
                date: candle.date
            });
        }
    }
    
    // Calculate score based on pattern counts
    result.score += noSupplyCount * 2;
    result.score += demandComingInCount * 3;
    result.score += absorptionVolumeCount * 4;
    result.score += effortVsResultCount * 3;
    result.score += stopVolumeCount * 3;
    
    // Determine overall volume signature
    if (absorptionVolumeCount >= 2 || stopVolumeCount >= 2) {
        result.signature = 'Strong Absorption';
    } else if (demandComingInCount >= 2) {
        result.signature = 'Increasing Demand';
    } else if (noSupplyCount >= 3) {
        result.signature = 'Weak Supply';
    } else if (effortVsResultCount >= 2) {
        result.signature = 'Failed Downmove';
    } else if ((noSupplyCount + demandComingInCount + absorptionVolumeCount + stopVolumeCount) >= 3) {
        result.signature = 'Mixed Accumulation';
    }
    
    // Determine if VSA patterns are detected
    result.detected = result.score >= 5 + (10 - options.sensitivityLevel);
    
    // Calculate days since first detection
    if (result.detected) {
        // Find the earliest day with any pattern
        const allDays = [...noSupplyDays, ...demandComingInDays, ...absorptionVolumeDays, 
                         ...effortVsResultDays, ...stopVolumeDays];
        
        if (allDays.length > 0) {
            const earliestDay = Math.min(...allDays);
            result.daysDetected = data.length - earliestDay;
        }
    }
    
    return result;
}

// Calculate average candle height (high-low range)
function calculateAvgCandleHeight(candles) {
    if (!candles || candles.length === 0) return 0;
    
    const sum = candles.reduce((total, candle) => total + (candle.high - candle.low), 0);
    return sum / candles.length;
}

// Calculate average volume
function calculateAvgVolume(candles) {
    if (!candles || candles.length === 0) return 0;
    
    const sum = candles.reduce((total, candle) => total + candle.volume, 0);
    return sum / candles.length;
}

// Calculate candle height (high-low range)
function candleHeight(candle) {
    return candle.high - candle.low;
}

// Check if candle closed in upper half of its range
function isInUpperHalf(candle) {
    const halfway = candle.low + (candle.high - candle.low) / 2;
    return candle.close > halfway;
}

// Check if candle closed in lower half of its range
function isInLowerHalf(candle) {
    const halfway = candle.low + (candle.high - candle.low) / 2;
    return candle.close < halfway;
}

function detectOBVAccumulation(data, options) {
    // Initialize result
    const result = {
        detected: false,
        score: 0,
        strength: null,
        daysDetected: 0,
        details: {}
    };
    
    // Need at least 30 data points for reliable OBV analysis
    if (data.length < 30) {
        return result;
    }
    
    // Adjust thresholds based on sensitivity
    const obvDriftThreshold = options.thresholds.obvDrift;
    const obvSensitivity = options.obvSensitivity / 10; // Convert to 0.1-1.0 range
    
    // Time periods to analyze
    const periods = [20, 40, 60];
    let longestPeriod = 0;
    
    // For each period, check if OBV is trending up while price is flat or down
    periods.forEach(period => {
        if (data.length < period + 5) return;
        
        // Get start and end points for the period
        const startIdx = data.length - period;
        const endIdx = data.length - 1;
        
        // Calculate price change
        const startPrice = data[startIdx].close;
        const endPrice = data[endIdx].close;
        const priceChangePercent = ((endPrice - startPrice) / startPrice) * 100;
        
        // Calculate OBV change
        const startOBV = data[startIdx].obv;
        const endOBV = data[endIdx].obv;
        const obvChangePercent = startOBV !== 0 ? ((endOBV - startOBV) / Math.abs(startOBV)) * 100 : 0;
        
        // Check for divergence: OBV rising while price is flat or falling
        const obvRising = obvChangePercent > obvDriftThreshold * 10; // Convert to percentage
        const priceFlat = Math.abs(priceChangePercent) < 5; // 5% price range is considered flat
        const priceFalling = priceChangePercent < 0;
        
        // Detect bullish OBV divergence
        if (obvRising && (priceFlat || priceFalling)) {
            // Calculate strength of divergence
            const divergenceStrength = Math.abs(obvChangePercent - priceChangePercent);
            
            // Store details
            result.details[`divergence${period}`] = {
                priceChange: priceChangePercent.toFixed(2) + '%',
                obvChange: obvChangePercent.toFixed(2) + '%',
                divergenceStrength: divergenceStrength.toFixed(2),
                isBullish: true
            };
            
            // Add to score based on strength
            let periodScore = 0;
            
            if (divergenceStrength > 15) {
                periodScore = 10; // Strong divergence
                result.details[`divergence${period}`].strength = 'Strong';
            } else if (divergenceStrength > 10) {
                periodScore = 8; // Moderate divergence
                result.details[`divergence${period}`].strength = 'Moderate';
            } else if (divergenceStrength > 5) {
                periodScore = 5; // Weak divergence
                result.details[`divergence${period}`].strength = 'Weak';
            } else {
                periodScore = 3; // Very weak divergence
                result.details[`divergence${period}`].strength = 'Very Weak';
            }
            
            // Add sensitivity adjustment
            periodScore *= (0.7 + obvSensitivity * 0.6);
            
            // Add to total score
            result.score += periodScore;
            
            // Update longest period with divergence
            if (period > longestPeriod) {
                longestPeriod = period;
            }
        }
    });
    
    // Check for Volume-Price confirmation
    const recentVolume = data.slice(-10);
    const recentVolumeDown = recentVolume.filter(candle => 
        candle.close < candle.open && candle.volume > candle.avgVolume);
    const recentVolumeUp = recentVolume.filter(candle => 
        candle.close > candle.open && candle.volume > candle.avgVolume);
    
    // Higher volume on up days is additional confirmation
    if (recentVolumeUp.length > recentVolumeDown.length && recentVolumeUp.length >= 3) {
        result.score += 5;
        result.details.volumePriceConfirmation = 'Higher volume on up days';
    }
    
    // Lower volume on down days is a good sign
    if (recentVolumeDown.length > 0 && 
        recentVolumeDown.every(candle => candle.volume < candle.avgVolume * 1.2)) {
        result.score += 3;
        result.details.volumePriceConfirmation = 'Lower volume on down days';
    }
    
    // Check recent OBV trend (last 5 days vs previous 5)
    const last5Days = data.slice(-5);
    const prev5Days = data.slice(-10, -5);
    
    const last5OBV = last5Days[last5Days.length - 1].obv;
    const prev5OBV = prev5Days[prev5Days.length - 1].obv;
    
    if (last5OBV > prev5OBV) {
        result.score += 3;
        result.details.recentOBVTrend = 'Improving';
    }
    
    // Determine overall OBV strength
    if (result.score >= 15) {
        result.strength = 'Strong';
    } else if (result.score >= 10) {
        result.strength = 'Moderate';
    } else if (result.score >= 5) {
        result.strength = 'Weak';
    }
    
    // Set detection flag based on score threshold
    result.detected = result.score >= 5;
    
    // Set days detected if applicable
    if (result.detected && longestPeriod > 0) {
        result.daysDetected = longestPeriod;
    }
    
    return result;
}

function detectRSIDivergence(data, options) {
    // Initialize result
    const result = {
        detected: false,
        score: 0,
        strength: null,
        details: {}
    };
    
    // Need at least 30 data points for reliable RSI divergence
    if (data.length < 30) {
        return result;
    }
    
    // Get RSI period from options
    const rsiPeriod = options.rsiPeriod || 14;
    
    // Make sure RSI is calculated
    if (!data[data.length - 1].rsi) {
        calculateRSI(data, rsiPeriod);
    }
    
    // Adjust thresholds based on sensitivity
    const rsiDivergenceThreshold = options.thresholds.rsiDivergence;
    const sensitivity = options.sensitivityLevel / 10; // Convert to 0.1-1.0 range
    
    // Find price lows and RSI lows in the recent data
    const priceLows = findPriceLows(data);
    const rsiLows = findRSILows(data);
    
    // Check for regular bullish divergence (price making lower lows, RSI making higher lows)
    const regularDivergence = checkRegularDivergence(data, priceLows, rsiLows);
    
    if (regularDivergence.detected) {
        result.detected = true;
        result.score += regularDivergence.strength * 5;
        result.details.regularDivergence = regularDivergence;
    }
    
    // Check for hidden bullish divergence (price making higher lows, RSI making lower lows)
    const hiddenDivergence = checkHiddenDivergence(data, priceLows, rsiLows);
    
    if (hiddenDivergence.detected) {
        result.detected = true;
        result.score += hiddenDivergence.strength * 4;
        result.details.hiddenDivergence = hiddenDivergence;
    }
    
    // Check for RSI values in oversold territory (RSI < 30) as additional confirmation
    const recentOversold = checkRecentOversold(data);
    
    if (recentOversold.detected) {
        result.score += 5;
        result.details.recentOversold = recentOversold;
    }
    
    // Adjust score based on sensitivity
    result.score *= (0.7 + sensitivity * 0.6);
    
    // Determine overall strength
    if (result.score >= 15) {
        result.strength = 'Strong';
    } else if (result.score >= 10) {
        result.strength = 'Moderate';
    } else if (result.score >= 5) {
        result.strength = 'Weak';
    }
    
    return result;
}

// Helper function to find price lows
function findPriceLows(data) {
    const lows = [];
    
    // Start from the 5th element to have enough previous candles to compare
    for (let i = 5; i < data.length - 5; i++) {
        const current = data[i];
        const prev2 = data.slice(i - 2, i);
        const next2 = data.slice(i + 1, i + 3);
        
        // Check if this is a local low
        if (current.low < Math.min(...prev2.map(c => c.low)) && 
            current.low < Math.min(...next2.map(c => c.low))) {
            lows.push({
                index: i,
                price: current.low,
                date: current.date
            });
        }
    }
    
    // Sort by index (chronological order)
    lows.sort((a, b) => a.index - b.index);
    
    return lows;
}

// Helper function to find RSI lows
function findRSILows(data) {
    const lows = [];
    
    // Start from a point where RSI is calculated
    let startIndex = 0;
    while (startIndex < data.length && data[startIndex].rsi === undefined) {
        startIndex++;
    }
    
    // Start looking from 5 candles after RSI starts
    startIndex = Math.max(startIndex + 5, 5);
    
    for (let i = startIndex; i < data.length - 5; i++) {
        const current = data[i];
        const prev2 = data.slice(i - 2, i);
        const next2 = data.slice(i + 1, i + 3);
        
        // Skip if RSI is not calculated
        if (current.rsi === undefined) continue;
        
        // Check if this is a local RSI low
        if (current.rsi < Math.min(...prev2.map(c => c.rsi || 100)) && 
            current.rsi < Math.min(...next2.map(c => c.rsi || 100))) {
            lows.push({
                index: i,
                rsi: current.rsi,
                date: current.date
            });
        }
    }
    
    // Sort by index (chronological order)
    lows.sort((a, b) => a.index - b.index);
    
    return lows;
}

// Check for regular bullish divergence
function checkRegularDivergence(data, priceLows, rsiLows) {
    const result = {
        detected: false,
        strength: 0,
        points: []
    };
    
    // Need at least 2 price lows and 2 RSI lows
    if (priceLows.length < 2 || rsiLows.length < 2) {
        return result;
    }
    
    // Get the most recent lows (last 30% of the data)
    const startIndex = Math.floor(data.length * 0.7);
    const recentPriceLows = priceLows.filter(low => low.index >= startIndex);
    const recentRSILows = rsiLows.filter(low => low.index >= startIndex);
    
    // Need at least 2 recent lows
    if (recentPriceLows.length < 2 || recentRSILows.length < 2) {
        return result;
    }
    
    // Get the last 2 price lows and RSI lows
    const lastPriceLows = recentPriceLows.slice(-2);
    const lastRSILows = recentRSILows.slice(-2);
    
    // Check for regular divergence (price lower, RSI higher)
    if (lastPriceLows[1].price < lastPriceLows[0].price && 
        lastRSILows[1].rsi > lastRSILows[0].rsi) {
        
        result.detected = true;
        
        // Calculate strength based on the degree of divergence
        const priceDiff = (lastPriceLows[0].price - lastPriceLows[1].price) / lastPriceLows[0].price;
        const rsiDiff = (lastRSILows[1].rsi - lastRSILows[0].rsi) / lastRSILows[0].rsi;
        
        // Combined strength (0-3)
        result.strength = Math.min(3, (priceDiff * 100 + rsiDiff * 30));
        
        // Add divergence points
        result.points = [
            {
                priceIndex: lastPriceLows[0].index,
                priceValue: lastPriceLows[0].price,
                rsiIndex: lastRSILows[0].index,
                rsiValue: lastRSILows[0].rsi,
                date: lastPriceLows[0].date
            },
            {
                priceIndex: lastPriceLows[1].index,
                priceValue: lastPriceLows[1].price,
                rsiIndex: lastRSILows[1].index,
                rsiValue: lastRSILows[1].rsi,
                date: lastPriceLows[1].date
            }
        ];
    }
    
    return result;
}

// Check for hidden bullish divergence
function checkHiddenDivergence(data, priceLows, rsiLows) {
    const result = {
        detected: false,
        strength: 0,
        points: []
    };
    
    // Need at least 2 price lows and 2 RSI lows
    if (priceLows.length < 2 || rsiLows.length < 2) {
        return result;
    }
    
    // Get the most recent lows (last 30% of the data)
    const startIndex = Math.floor(data.length * 0.7);
    const recentPriceLows = priceLows.filter(low => low.index >= startIndex);
    const recentRSILows = rsiLows.filter(low => low.index >= startIndex);
    
    // Need at least 2 recent lows
    if (recentPriceLows.length < 2 || recentRSILows.length < 2) {
        return result;
    }
    
    // Get the last 2 price lows and RSI lows
    const lastPriceLows = recentPriceLows.slice(-2);
    const lastRSILows = recentRSILows.slice(-2);
    
    // Check for hidden divergence (price higher, RSI lower)
    if (lastPriceLows[1].price > lastPriceLows[0].price && 
        lastRSILows[1].rsi < lastRSILows[0].rsi) {
        
        result.detected = true;
        
        // Calculate strength based on the degree of divergence
        const priceDiff = (lastPriceLows[1].price - lastPriceLows[0].price) / lastPriceLows[0].price;
        const rsiDiff = (lastRSILows[0].rsi - lastRSILows[1].rsi) / lastRSILows[0].rsi;
        
        // Combined strength (0-3)
        result.strength = Math.min(3, (priceDiff * 80 + rsiDiff * 20));
        
        // Add divergence points
        result.points = [
            {
                priceIndex: lastPriceLows[0].index,
                priceValue: lastPriceLows[0].price,
                rsiIndex: lastRSILows[0].index,
                rsiValue: lastRSILows[0].rsi,
                date: lastPriceLows[0].date
            },
            {
                priceIndex: lastPriceLows[1].index,
                priceValue: lastPriceLows[1].price,
                rsiIndex: lastRSILows[1].index,
                rsiValue: lastRSILows[1].rsi,
                date: lastPriceLows[1].date
            }
        ];
    }
    
    return result;
}

// Check for recent oversold RSI values
function checkRecentOversold(data) {
    const result = {
        detected: false,
        count: 0,
        lastDate: null
    };
    
    // Check the last 15 days
    const recentData = data.slice(-15);
    let oversoldCount = 0;
    let lastOversoldDay = null;
    
    recentData.forEach((day, index) => {
        if (day.rsi !== undefined && day.rsi <= RSI_OVERSOLD) {
            oversoldCount++;
            lastOversoldDay = day;
        }
    });
    
    if (oversoldCount > 0) {
        result.detected = true;
        result.count = oversoldCount;
        result.lastDate = lastOversoldDay.date;
    }
    
    return result;
}

// Function to determine if a stock should be hidden based on filters
function shouldHideStock(symbol) {
    // This function is missing in the original code
    // By default, don't hide any stocks
    return false;
}

function displayAccumulationStocks() {
    // Make sure the table reference exists, otherwise try to get it
    if (!accumulationStocksTable) {
        accumulationStocksTable = document.querySelector('#accumulationTable tbody');
        
        // If still not found, display an error and return
        if (!accumulationStocksTable) {
            console.error('Cannot display accumulation stocks: Table not found');
            return;
        }
    }
    
    // Sort stocks by score before displaying
    accumulationStocks.sort((a, b) => b.score - a.score);
    
    // Clear existing content
    accumulationStocksTable.innerHTML = '';
    
    // Initialize counters for confidence levels
    let highConfidence = 0;
    let mediumConfidence = 0;
    let lowConfidence = 0;
    
    // Add each stock to the table
    accumulationStocks.forEach((stock, index) => {
        // Count by confidence
        if (stock.confidence === 'high') highConfidence++;
        else if (stock.confidence === 'medium') mediumConfidence++;
        else lowConfidence++;
        
        // Create a row for this stock
        const row = document.createElement('tr');
        row.className = `stock-row ${shouldHideStock(stock.symbol) ? 'filtered' : ''}`;
        row.setAttribute('data-symbol', stock.symbol);
        row.setAttribute('data-score', stock.score);
        
        // Format the patterns list
        const patternsText = formatPatternsList(stock.patterns);
        
        // Create row content
        row.innerHTML = `
            <td class="column-symbol">${stock.symbol}</td>
            <td class="column-price">${formatPrice(stock.price)}</td>
            <td class="column-score">
                <div class="score-indicator score-${stock.confidence}">
                    ${stock.score.toFixed(1)}
                </div>
            </td>
            <td class="column-confidence">
                <div class="confidence-text">${capitalizeFirstLetter(stock.confidence)}</div>
            </td>
            <td class="column-patterns">${patternsText}</td>
            <td class="column-volume">${stock.volumeSignature || 'N/A'}</td>
            <td class="column-days">${stock.daysInAccumulation}</td>
            <td class="column-actions">
                <button class="action-button details-button" data-index="${index}" title="View Details">
                    <i class="icon">📊</i>
                </button>
                <button class="action-button mark-buying-button ${isBuyingSymbol(stock.symbol) ? 'active' : ''}" data-index="${index}" title="${isBuyingSymbol(stock.symbol) ? 'Remove from Buying List' : 'Mark as Buying'}">
                    <i class="icon">${isBuyingSymbol(stock.symbol) ? '💰' : '💵'}</i>
                </button>
                <button class="action-button watchlist-button ${isInWatchlist(stock.symbol) ? 'active' : ''}" data-index="${index}" title="${isInWatchlist(stock.symbol) ? 'Remove from Watchlist' : 'Add to Watchlist'}">
                    <i class="icon">${isInWatchlist(stock.symbol) ? '★' : '☆'}</i>
                </button>
            </td>
            <td class="column-chart">
                <div id="chart-${stock.symbol}" class="chart-container-small" data-symbol="${stock.symbol}"></div>
            </td>
        `;
        
        // Add event listeners to buttons
        const detailsButton = row.querySelector('.details-button');
        detailsButton.addEventListener('click', () => {
            showFullScreenChart(stock.symbol, stock);
        });
        
        const markBuyingButton = row.querySelector('.mark-buying-button');
        markBuyingButton.addEventListener('click', () => {
            toggleBuyingStock(index);
        });
        
        const watchlistButton = row.querySelector('.watchlist-button');
        watchlistButton.addEventListener('click', () => {
            toggleWatchlistStock(index);
        });
        
        // Add the row to the table
        accumulationStocksTable.appendChild(row);
    });
    
    // Update counters display
    const highCountElement = document.getElementById('highConfidenceCount');
    const medCountElement = document.getElementById('mediumConfidenceCount');
    const lowCountElement = document.getElementById('lowConfidenceCount');
    const totalCountElement = document.getElementById('totalStocksCount');

    if (highCountElement) highCountElement.textContent = highConfidence;
    if (medCountElement) medCountElement.textContent = mediumConfidence;
    if (lowCountElement) lowCountElement.textContent = lowConfidence;
    if (totalCountElement) totalCountElement.textContent = accumulationStocks.length;
    
    // Now initialize the charts
    setTimeout(() => {
        accumulationStocks.forEach(stock => {
            initializeStockChart(stock.symbol, `chart-${stock.symbol}`);
        });
        // Set up chart click events
        setupChartClickEvents();
    }, 100);
    
    // Update the buy candidates in the conclusion tab
    updateBuyCandidates();
}

// Function to update the buy candidates list in the conclusion tab
function updateBuyCandidates() {
    const conclusionTableBody = document.querySelector('#conclusionTable tbody');
    const noCandidatesMessage = document.getElementById('noCandidatesMessage');
    const conclusionContent = document.getElementById('conclusionContent');
    
    // Check if the conclusion tab content exists and is visible
    const isTabActive = conclusionContent && 
                      (conclusionContent.classList.contains('active') || 
                       window.getComputedStyle(conclusionContent).display !== 'none');
    
    if (!conclusionTableBody) {
        console.error('Cannot update buy candidates: Table not found');
        return;
    }
    
    // Clear existing content
    conclusionTableBody.innerHTML = '';
    
    // Filter for only the BEST buy candidates with more stringent criteria
    const buyCandidates = accumulationStocks.filter(stock => {
        // ALWAYS include manually marked buying stocks regardless of other criteria
        if (isBuyingSymbol(stock.symbol)) {
            return true;
        }
        
        // Get price trend information
        const priceTrend = analyzePriceTrend(stock.symbol);
        
        // Check for volume confirmation
        const hasVolumeConfirmation = stock.volumeSignature && 
            (stock.volumeSignature.includes('Strong Absorption') || 
             stock.volumeSignature.includes('Increasing Demand'));
        
        // Check for specific Wyckoff events
        const hasWyckoffEvent = stock.details?.wyckoff?.events?.some(e => 
            e.type === 'Spring' || 
            e.type === 'Sign of Strength' || 
            e.type === 'Last Point of Support');
        
        // Check for bullish RSI conditions
        const hasRSIConfirmation = hasPositiveRSI(stock.symbol);
        
        // Check for favorable price trend (must not be in downtrend)
        const hasFavorableTrend = priceTrend.trend !== 'down';
        
        // Check for OBV confirmation
        const hasOBVConfirmation = stock.details?.obv?.strength === 'Strong' || 
                                   stock.details?.obv?.strength === 'Moderate';
        
        // Require minimum number of pattern confirmations
        const patternCount = stock.patterns ? stock.patterns.length : 0;
        
        // VERY HIGH CONFIDENCE: Include regardless of other factors if extreme confidence
        if (stock.confidence === 'veryhigh' && stock.score >= 45) {
            return true;
        }
        
        // HIGH CONFIDENCE: Must meet strict criteria
        if (stock.confidence === 'high' || stock.score >= 35) {
            // Must have favorable trend
            if (!hasFavorableTrend) return false;
            
            // Must have at least 2 different patterns
            if (patternCount < 2) return false;
            
            // Must have at least 2 of these confirmations
            const confirmationCount = [
                hasVolumeConfirmation,
                hasWyckoffEvent,
                hasRSIConfirmation,
                hasOBVConfirmation
            ].filter(Boolean).length;
            
            return confirmationCount >= 2;
        }
        
        // MEDIUM CONFIDENCE: Need very strong other signals
        if (stock.confidence === 'medium' && stock.score >= 25) {
            // Must have favorable trend
            if (!hasFavorableTrend) return false;
            
            // Must have at least 3 patterns
            if (patternCount < 3) return false;
            
            // Must have at least 3 of these confirmations
            const confirmationCount = [
                hasVolumeConfirmation,
                hasWyckoffEvent,
                hasRSIConfirmation,
                hasOBVConfirmation
            ].filter(Boolean).length;
            
            return confirmationCount >= 3;
        }
        
        // Reject all other cases
        return false;
    });
    
    // Show message if no buy candidates
    if (buyCandidates.length === 0) {
        if (noCandidatesMessage) {
            noCandidatesMessage.style.display = 'block';
        }
        return;
    } else if (noCandidatesMessage) {
        noCandidatesMessage.style.display = 'none';
    }
    
    // Sort candidates by most promising first (prioritize bought stocks, then by score)
    buyCandidates.sort((a, b) => {
        // First priority: Manual buying flag
        const aIsBuying = isBuyingSymbol(a.symbol);
        const bIsBuying = isBuyingSymbol(b.symbol);
        if (aIsBuying && !bIsBuying) return -1;
        if (!aIsBuying && bIsBuying) return 1;
        
        // Second priority: Score
        return b.score - a.score;
    });
    
    // Store chart containers to initialize later (helps prevent rendering issues)
    const chartContainers = [];
    
    // Add each buy candidate to the table
    buyCandidates.forEach((stock, index) => {
        const row = document.createElement('tr');
        row.className = `stock-row`;
        row.setAttribute('data-symbol', stock.symbol);
        
        // Determine buy signal strength
        let buySignal = 'Potential';
        let signalClass = 'medium';
        
        if (isBuyingSymbol(stock.symbol)) {
            buySignal = 'Confirmed';
            signalClass = 'high';
        } else if (stock.confidence === 'veryhigh' || stock.score >= 40) {
            buySignal = 'Strong';
            signalClass = 'high';
        } else if (stock.confidence === 'high' || stock.score >= 30) {
            buySignal = 'Moderate';
            signalClass = 'medium';
        }
        
        // Get key patterns
        const keyPatterns = getKeyPatterns(stock);
        
        // Get volume evidence
        const volumeEvidence = getVolumeEvidence(stock);
        
        // Get risk assessment
        const riskRating = assessRisk(stock);
        
        // Get estimated timeframe until markup phase
        const buyTimeEstimate = estimateBuyTimeframe(stock);
        
        // Create row content
        row.innerHTML = `
            <td class="column-symbol">${stock.symbol}</td>
            <td class="column-price">${formatPrice(stock.price)}</td>
            <td class="column-score">
                <div class="score-indicator score-${stock.confidence}">
                    ${stock.score.toFixed(1)}
                </div>
            </td>
            <td class="column-confidence">
                <div class="confidence-text">${capitalizeFirstLetter(stock.confidence)}</div>
            </td>
            <td class="column-buy-signal">
                <div class="score-indicator score-${signalClass}">
                    ${buySignal}
                </div>
                <div class="risk-rating risk-${riskRating.level}">
                    ${riskRating.level.toUpperCase()} Risk
                </div>
            </td>
            <td class="column-key-patterns">${keyPatterns}</td>
            <td class="column-volume-evidence">${volumeEvidence}</td>
            <td class="column-timeframe">
                <div class="buy-timeframe">${buyTimeEstimate.message}</div>
            </td>
            <td class="column-actions">
                <button class="action-button details-button" data-symbol="${stock.symbol}" title="View Details">
                    <i class="icon">📊</i>
                </button>
                <button class="action-button mark-buying-button ${isBuyingSymbol(stock.symbol) ? 'active' : ''}" data-symbol="${stock.symbol}" title="${isBuyingSymbol(stock.symbol) ? 'Remove from Buying List' : 'Mark as Buying'}">
                    <i class="icon">${isBuyingSymbol(stock.symbol) ? '💰' : '💵'}</i>
                </button>
                <button class="action-button watchlist-button ${isInWatchlist(stock.symbol) ? 'active' : ''}" data-symbol="${stock.symbol}" title="${isInWatchlist(stock.symbol) ? 'Remove from Watchlist' : 'Add to Watchlist'}">
                    <i class="icon">${isInWatchlist(stock.symbol) ? '★' : '☆'}</i>
                </button>
            </td>
            <td class="column-chart">
                <div id="conclusion-chart-${stock.symbol}" class="chart-container-small" data-symbol="${stock.symbol}"></div>
            </td>
        `;
        
        // Add the row to the table
        conclusionTableBody.appendChild(row);
        
        // Track chart container for initialization
        chartContainers.push({
            symbol: stock.symbol,
            containerId: `conclusion-chart-${stock.symbol}`
        });
    });
    
    // Only initialize charts if the tab is currently visible
    // This prevents rendering conflicts when tab is hidden
    if (chartContainers.length > 0 && isTabActive) {
        // First make sure any existing chart instances are cleared
        chartContainers.forEach(container => {
            const id = container.containerId;
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = ''; // Clear the container first
            }
            
            // Also clean up any existing chart instance
            if (chartInstances[container.symbol] && chartInstances[container.symbol].chart) {
                try {
                    // Handle both D3 and LightweightCharts cleanup
                    if (typeof chartInstances[container.symbol].chart.remove === 'function') {
                        chartInstances[container.symbol].chart.remove();
                    }
                } catch (e) {
                    console.warn(`Error cleaning up chart for ${container.symbol}:`, e);
                }
                delete chartInstances[container.symbol];
            }
        });

        // Short delay to ensure DOM is ready
        setTimeout(() => {
            // Only initialize charts if the tab is still visible
            if (isTabActive) {
                // Initialize charts one by one with small delays to prevent rendering issues
                chartContainers.forEach((container, index) => {
                    setTimeout(() => {
                        if (document.getElementById(container.containerId)) {
                            initializeStockChart(container.symbol, container.containerId);
                        }
                    }, index * 20); // Stagger initialization with 20ms between each chart
                });
                
                // Setup chart click events
                setupChartClickEvents();
            }
        }, 50);
    }
}

// Analyze price trend of a stock over multiple timeframes
function analyzePriceTrend(symbol) {
    const data = stockHistoricalData[symbol];
    if (!data || data.length < 30) {
        return { trend: 'unknown', strength: 0 };
    }
    
    // Define timeframes to analyze
    const timeframes = [
        { days: 5, weight: 0.4 },   // Short-term (last week)
        { days: 20, weight: 0.3 },  // Medium-term (last month)
        { days: 60, weight: 0.3 }   // Long-term (last quarter)
    ];
    
    let trendScore = 0;
    
    // Analyze each timeframe
    timeframes.forEach(timeframe => {
        if (data.length < timeframe.days) return;
        
        const period = data.slice(-timeframe.days);
        const firstPrice = period[0].close;
        const lastPrice = period[period.length - 1].close;
        
        // Calculate price change percentage
        const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;
        
        // Determine trend direction for this timeframe
        if (changePercent > 3) {
            // Strong uptrend
            trendScore += 1 * timeframe.weight;
        } else if (changePercent > 0.5) {
            // Slight uptrend
            trendScore += 0.5 * timeframe.weight;
        } else if (changePercent < -3) {
            // Strong downtrend
            trendScore -= 1 * timeframe.weight;
        } else if (changePercent < -0.5) {
            // Slight downtrend
            trendScore -= 0.5 * timeframe.weight;
        }
        // Otherwise sideways (score unchanged)
    });
    
    // Determine overall trend based on weighted score
    let trend;
    if (trendScore > 0.3) {
        trend = 'up';
    } else if (trendScore < -0.3) {
        trend = 'down';
    } else {
        trend = 'sideways';
    }
    
    return { trend, strength: Math.abs(trendScore) };
}

// Check for positive RSI conditions
function hasPositiveRSI(symbol) {
    const data = stockHistoricalData[symbol];
    if (!data || data.length < 30) {
        return false;
    }
    
    const recentData = data.slice(-10);
    
    // Check for oversold RSI that's starting to rise
    let hasOversold = false;
    let hasRising = false;
    
    for (let i = 0; i < recentData.length; i++) {
        const day = recentData[i];
        
        // Skip if RSI is not available
        if (day.rsi === undefined) continue;
        
        // Check for oversold condition (RSI < 30)
        if (day.rsi < 30) {
            hasOversold = true;
        }
        
        // Check for rising RSI in last 3 days
        if (i >= 2 && day.rsi > recentData[i-1].rsi && recentData[i-1].rsi > recentData[i-2].rsi) {
            hasRising = true;
        }
    }
    
    // Check for positive RSI divergence
    const hasRSIDivergence = data.some(day => day.rsiDivergence);
    
    // Return true if either condition is met
    return (hasOversold && hasRising) || hasRSIDivergence;
}

// Assess risk level of a stock
function assessRisk(stock) {
    let riskScore = 0;
    const result = { level: 'medium', factors: [] };
    
    // 1. Check score and confidence
    if (stock.confidence === 'veryhigh' || stock.score >= 40) {
        riskScore -= 2; // Lower risk
        result.factors.push('High confidence score');
    } else if (stock.confidence === 'low' || stock.score < 20) {
        riskScore += 2; // Higher risk
        result.factors.push('Low confidence score');
    }
    
    // 2. Check for Wyckoff spring (strong confirmation)
    if (stock.details && stock.details.wyckoff && stock.details.wyckoff.events) {
        if (stock.details.wyckoff.events.some(e => e.type === 'Spring')) {
            riskScore -= 2; // Lower risk
            result.factors.push('Wyckoff spring detected');
        }
    }
    
    // 3. Check volume pattern confidence
    if (stock.volumeSignature && 
        (stock.volumeSignature.includes('Strong') || stock.volumeSignature.includes('Absorption'))) {
        riskScore -= 1; // Lower risk
        result.factors.push('Strong volume signature');
    }
    
    // 4. Check pattern count
    if (stock.patterns && stock.patterns.length >= 3) {
        riskScore -= 1; // Lower risk
        result.factors.push('Multiple pattern confirmations');
    }
    
    // 5. Analyze price volatility
    const priceVolatility = analyzePriceVolatility(stock.symbol);
    if (priceVolatility.isHigh) {
        riskScore += 2; // Higher risk
        result.factors.push('High price volatility');
    } else if (priceVolatility.isLow) {
        riskScore -= 1; // Lower risk
        result.factors.push('Low price volatility');
    }
    
    // 6. Check for manual buying flag (user's own assessment)
    if (isBuyingSymbol(stock.symbol)) {
        riskScore -= 1; // Lower risk
        result.factors.push('User confirmed buying');
    }
    
    // Determine final risk level
    if (riskScore <= -3) {
        result.level = 'low';
    } else if (riskScore >= 2) {
        result.level = 'high';
    } else {
        result.level = 'medium';
    }
    
    return result;
}

// Analyze price volatility
function analyzePriceVolatility(symbol) {
    const data = stockHistoricalData[symbol];
    if (!data || data.length < 20) {
        return { isHigh: false, isLow: false, value: 0 };
    }
    
    const recentData = data.slice(-20);
    let totalVolatility = 0;
    
    // Calculate average daily volatility
    for (let i = 1; i < recentData.length; i++) {
        const prevClose = recentData[i-1].close;
        const dayRange = (recentData[i].high - recentData[i].low) / prevClose * 100;
        totalVolatility += dayRange;
    }
    
    const avgVolatility = totalVolatility / (recentData.length - 1);
    
    return {
        isHigh: avgVolatility > 3,  // 3% daily range is considered high volatility
        isLow: avgVolatility < 1.5, // 1.5% daily range is considered low volatility
        value: avgVolatility
    };
}

// Estimate timeframe until markup phase based on accumulation patterns
function estimateBuyTimeframe(stock) {
    const result = {
        daysEstimate: 0,
        confidence: 'low',
        message: 'Unknown'
    };
    
    // Check if already in markup phase
    if (stock.details && stock.details.wyckoff && stock.details.wyckoff.phase === 'PhaseE') {
        result.daysEstimate = 0;
        result.confidence = 'high';
        result.message = 'Ready now (Markup phase)';
        return result;
    }
    
    // Check current phase
    let currentPhase = '';
    let daysInPhase = 0;
    
    if (stock.details && stock.details.wyckoff) {
        currentPhase = stock.details.wyckoff.phase || '';
        daysInPhase = stock.details.wyckoff.daysInPhase || 0;
    }
    
    // Estimate days based on current phase
    if (currentPhase === 'PhaseD') {
        // Late accumulation, almost ready
        result.daysEstimate = Math.max(0, 7 - daysInPhase);
        result.confidence = 'high';
        result.message = result.daysEstimate <= 0 ? 
            'Ready now (Late accumulation)' : 
            `Ready soon (≈${result.daysEstimate} days)`;
    } else if (currentPhase === 'PhaseC') {
        // Mid accumulation, getting closer
        result.daysEstimate = Math.max(7, 21 - daysInPhase);
        result.confidence = 'medium';
        result.message = `1-3 weeks (${currentPhase})`;
    } else if (currentPhase === 'PhaseB') {
        // Early to mid accumulation
        result.daysEstimate = Math.max(14, 42 - daysInPhase);
        result.confidence = 'medium';
        result.message = `2-6 weeks (${currentPhase})`;
    } else if (currentPhase === 'PhaseA') {
        // Very early accumulation
        result.daysEstimate = Math.max(21, 60 - daysInPhase);
        result.confidence = 'low';
        result.message = `4-8 weeks (${currentPhase})`;
    } else {
        // No specific phase identified, use general accumulation days
        if (stock.daysInAccumulation > 30) {
            result.daysEstimate = 7;
            result.confidence = 'medium';
            result.message = '1-2 weeks (Late accumulation)';
        } else if (stock.daysInAccumulation > 15) {
            result.daysEstimate = 21;
            result.confidence = 'low';
            result.message = '2-4 weeks (Mid accumulation)';
        } else {
            result.daysEstimate = 42;
            result.confidence = 'low';
            result.message = '4-6 weeks (Early accumulation)';
        }
    }
    
    // Check for specific Wyckoff events that indicate imminent markup
    if (stock.details && stock.details.wyckoff && stock.details.wyckoff.events) {
        const events = stock.details.wyckoff.events;
        const hasLPS = events.some(e => 
            e.type === 'Last Point of Support' && 
            (new Date() - new Date(e.date)) / (1000 * 60 * 60 * 24) < 10
        );
        
        const hasSOS = events.some(e => 
            e.type === 'Sign of Strength' && 
            (new Date() - new Date(e.date)) / (1000 * 60 * 60 * 24) < 7
        );
        
        if (hasLPS && hasSOS) {
            // Both LPS and SOS recently - very imminent
            result.daysEstimate = 0;
            result.confidence = 'high';
            result.message = 'Ready now (LPS + SOS)';
        } else if (hasLPS) {
            // Recent LPS indicates very near markup
            result.daysEstimate = 3;
            result.confidence = 'high';
            result.message = 'Very soon (LPS detected)';
        } else if (hasSOS) {
            // Recent SOS indicates near markup
            result.daysEstimate = 7;
            result.confidence = 'medium';
            result.message = 'Soon (SOS detected)';
        }
    }
    
    return result;
}

// Helper function to extract key patterns for buy candidates
function getKeyPatterns(stock) {
    let keyEvents = [];
    
    // Add Wyckoff events if available
    if (stock.details && stock.details.wyckoff && stock.details.wyckoff.events) {
        const importantEvents = stock.details.wyckoff.events.filter(e => 
            e.type === 'Spring' || 
            e.type === 'Sign of Strength' || 
            e.type === 'Last Point of Support' ||
            e.type === 'Backup' ||
            e.type === 'Test'
        );
        
        importantEvents.slice(0, 2).forEach(event => {
            keyEvents.push(`${event.type} (${formatDateShort(event.date)})`);
        });
    }
    
    // Add VSA patterns if available
    if (stock.details && stock.details.vsa && stock.details.vsa.patterns) {
        const importantPatterns = stock.details.vsa.patterns.filter(p => 
            p.type === 'Absorption Volume' || 
            p.type === 'Demand Coming In' ||
            p.type === 'Stopping Volume'
        );
        
        importantPatterns.slice(0, 2).forEach(pattern => {
            keyEvents.push(`${pattern.type} (${formatDateShort(pattern.date)})`);
        });
    }
    
    // If still no events, add general pattern types
    if (keyEvents.length === 0 && stock.patterns && stock.patterns.length > 0) {
        const patternMap = {
            'wyckoff': 'Wyckoff Accumulation',
            'vsa': 'Volume Spread Analysis',
            'obv': 'Bullish OBV Divergence',
            'rsi': 'RSI Divergence'
        };
        
        stock.patterns.forEach(pattern => {
            keyEvents.push(patternMap[pattern] || pattern);
        });
    }
    
    return keyEvents.length > 0 ? keyEvents.join('<br>') : 'N/A';
}

// Helper function to extract volume evidence for buy candidates
function getVolumeEvidence(stock) {
    let evidence = [];
    
    // Add volume signature if available
    if (stock.volumeSignature) {
        evidence.push(`<strong>${stock.volumeSignature}</strong>`);
    }
    
    // Add OBV divergence if available
    if (stock.details && stock.details.obv && stock.details.obv.strength) {
        evidence.push(`${stock.details.obv.strength} OBV Divergence`);
    }
    
    // Add volume anomaly count if available from volume data
    const data = stockHistoricalData[stock.symbol];
    if (data && data.length > 20) {
        const recentData = data.slice(-20);
        const anomalies = recentData.filter(d => d.isVolumeAnomaly);
        const absorption = recentData.filter(d => d.isAbsorption);
        
        if (anomalies.length > 0) {
            evidence.push(`${anomalies.length} volume anomalies`);
        }
        
        if (absorption.length > 0) {
            evidence.push(`${absorption.length} absorption events`);
        }
    }
    
    return evidence.length > 0 ? evidence.join('<br>') : 'N/A';
}

// Helper function to format date as MM/DD
function formatDateShort(date) {
    if (!date) return '';
    
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Format the list of detected patterns with appropriate styling
function formatPatternsList(patterns) {
    if (!patterns || patterns.length === 0) {
        return 'None';
    }
    
    const patternLabels = {
        'wyckoff': 'Wyckoff',
        'vsa': 'VSA',
        'obv': 'OBV',
        'rsi': 'RSI Div'
    };
    
    // Make sure we're working with a proper array
    const patternsArray = Array.isArray(patterns) ? patterns : [patterns];
    
    return patternsArray.map(pattern => {
        // Ensure pattern is a string
        const patternStr = String(pattern).toLowerCase();
        return `<span class="pattern-tag pattern-${patternStr}">${patternLabels[patternStr] || pattern}</span>`;
    }).join(' ');
}

// Format price with appropriate decimal places
function formatPrice(price) {
    if (typeof price !== 'number') return 'N/A';
    
    // For high-priced stocks, use fewer decimal places
    if (price >= 1000) {
        return price.toFixed(0);
    } else if (price >= 100) {
        return price.toFixed(1);
    } else {
        return price.toFixed(2);
    }
}

// Capitalize first letter of a string
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function updatePatternAnalysis() {
    const patternChartContainer = document.getElementById('patternChartContainer');
    const patternTableBody = document.querySelector('#patternTable tbody');
    
    // Clear previous content
    patternTableBody.innerHTML = '';
    patternChartContainer.innerHTML = '';
    
    if (accumulationStocks.length === 0) {
        patternTableBody.innerHTML = '<tr><td colspan="6" class="no-data">No accumulation patterns detected</td></tr>';
        return;
    }
    
    // Render pattern details for each stock
    accumulationStocks.forEach(stock => {
        const row = document.createElement('tr');
        
        // Extract pattern-specific information
        let phaseInfo = 'N/A';
        let progressionValue = 0;
        let keyEvents = [];
        let confirmation = 'Low';
        
        // Process Wyckoff pattern details
        if (stock.details.wyckoff) {
            const wyckoff = stock.details.wyckoff;
            phaseInfo = wyckoff.phase || 'N/A';
            
            // Calculate progression based on phase
            if (phaseInfo === 'PhaseA') progressionValue = 20;
            else if (phaseInfo === 'PhaseB') progressionValue = 40;
            else if (phaseInfo === 'PhaseC') progressionValue = 60;
            else if (phaseInfo === 'PhaseD') progressionValue = 80;
            else if (phaseInfo === 'PhaseE') progressionValue = 100;
            
            // Extract key events
            keyEvents = wyckoff.events || [];
            
            // Set confirmation level based on score
            if (wyckoff.score >= 15) confirmation = 'High';
            else if (wyckoff.score >= 10) confirmation = 'Medium';
        }
        
        // Process VSA pattern details
        if (stock.details.vsa) {
            const vsa = stock.details.vsa;
            
            // Add VSA patterns to key events
            if (vsa.patterns && vsa.patterns.length > 0) {
                keyEvents = keyEvents.concat(vsa.patterns.slice(0, 3));
            }
            
            // Update confirmation if VSA score is high
            if (vsa.score >= 12 && confirmation !== 'High') {
                confirmation = 'High';
            } else if (vsa.score >= 8 && confirmation !== 'High') {
                confirmation = 'Medium';
            }
        }
        
        // Format key events display
        const keyEventsHtml = keyEvents.slice(0, 3).map(event => {
            return `<div class="event-tag">${event.type}</div>`;
        }).join('');
        
        // Create progress bar
        const progressHtml = `
            <div class="pattern-progress">
                <div class="pattern-progress-bar" style="width: ${progressionValue}%"></div>
            </div>
        `;
        
        // Create row
        row.innerHTML = `
            <td>${stock.symbol}</td>
            <td>${formatPatternsList(stock.patterns)}</td>
            <td>${phaseInfo}</td>
            <td>${progressionValue}% ${progressHtml}</td>
            <td>${keyEventsHtml}</td>
            <td><span class="score-indicator score-${confirmation.toLowerCase()}">${confirmation}</span></td>
        `;
        
        patternTableBody.appendChild(row);
    });
    
    // Create chart comparing patterns across stocks
    createPatternComparisonChart(patternChartContainer);
}

function updateVolumeAnalysis() {
    const volumeChartContainer = document.getElementById('volumeChartContainer');
    const volumeTableBody = document.querySelector('#volumeTable tbody');
    
    // Clear previous content
    volumeTableBody.innerHTML = '';
    volumeChartContainer.innerHTML = '';
    
    if (accumulationStocks.length === 0) {
        volumeTableBody.innerHTML = '<tr><td colspan="6" class="no-data">No volume patterns detected</td></tr>';
        return;
    }
    
    // Render volume analysis for each stock
    accumulationStocks.forEach(stock => {
        const row = document.createElement('tr');
        
        // Get historical data
        const data = stockHistoricalData[stock.symbol];
        if (!data) return;
        
        // Calculate volume trends
        const volumeTrend = calculateVolumeTrend(data);
        const obvTrend = calculateOBVTrend(data);
        const vwapRelation = calculateVWAPRelation(data);
        const volumeAnomalies = detectVolumeAnomalies(data);
        const absorption = detectAbsorptionVolume(data);
        
        // Create volume trend display
        const volumeTrendHtml = getVolumeDirectionHtml(volumeTrend);
        
        // Create OBV trend display
        const obvTrendHtml = getOBVTrendHtml(obvTrend);
        
        // Create VWAP relation display
        const vwapHtml = getVWAPRelationHtml(vwapRelation);
        
        // Create volume anomalies display
        const anomaliesHtml = getVolumeAnomaliesHtml(volumeAnomalies);
        
        // Create absorption display
        const absorptionHtml = getAbsorptionHtml(absorption);
        
        // Create row
        row.innerHTML = `
            <td>${stock.symbol}</td>
            <td>${volumeTrendHtml}</td>
            <td>${obvTrendHtml}</td>
            <td>${vwapHtml}</td>
            <td>${anomaliesHtml}</td>
            <td>${absorptionHtml}</td>
        `;
        
        volumeTableBody.appendChild(row);
    });
    
    // Create volume analysis charts
    createVolumeAnalysisCharts(volumeChartContainer);
}

// Calculate volume trend over the last 20 days
function calculateVolumeTrend(data) {
    if (!data || data.length < 30) return { direction: 'neutral', strength: 0 };
    
    const recentData = data.slice(-20);
    const firstHalf = recentData.slice(0, 10);
    const secondHalf = recentData.slice(10);
    
    const firstHalfAvg = calculateAvgVolume(firstHalf);
    const secondHalfAvg = calculateAvgVolume(secondHalf);
    
    const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
    
    let direction = 'neutral';
    let strength = Math.abs(changePercent);
    
    if (changePercent >= 5) {
        direction = 'increasing';
    } else if (changePercent <= -5) {
        direction = 'decreasing';
    }
    
    return { direction, strength, changePercent };
}

// Calculate OBV trend over the last 20 days
function calculateOBVTrend(data) {
    if (!data || data.length < 30) {
        console.log("Data missing or insufficient", data ? data.length : 0);
        return { direction: 'neutral', strength: 0, changePercent: 0 };
    }
    
    // Check if OBV exists in the data
    const hasOBV = data.some(item => item.obv !== undefined);
    if (!hasOBV) {
        console.log("No OBV data found in the dataset");
        return { direction: 'neutral', strength: 0, changePercent: 0 };
    }
    
    const recentData = data.slice(-20);
    
    // Find the first valid OBV value
    let firstPointIndex = 0;
    while (firstPointIndex < recentData.length && 
           (recentData[firstPointIndex].obv === undefined || 
            recentData[firstPointIndex].obv === 0)) {
        firstPointIndex++;
    }
    
    // Find the last valid OBV value
    let lastPointIndex = recentData.length - 1;
    while (lastPointIndex > 0 && 
           (recentData[lastPointIndex].obv === undefined || 
            isNaN(recentData[lastPointIndex].obv))) {
        lastPointIndex--;
    }
    
    // If we don't have at least 2 valid points, return neutral
    if (firstPointIndex >= lastPointIndex) {
        console.log("Not enough valid OBV data points");
        return { direction: 'neutral', strength: 0, changePercent: 0 };
    }
    
    const firstPoint = recentData[firstPointIndex].obv;
    const lastPoint = recentData[lastPointIndex].obv;
    
    console.log("OBV Comparison:", {
        firstPoint: firstPoint,
        lastPoint: lastPoint,
        firstIndex: firstPointIndex,
        lastIndex: lastPointIndex
    });
    
    let changePercent = 0;
    
    // Calculate percent change safely
    if (firstPoint !== 0 && !isNaN(firstPoint)) {
        changePercent = ((lastPoint - firstPoint) / Math.abs(firstPoint)) * 100;
    } else if (lastPoint > 0) {
        // If firstPoint is zero or invalid but lastPoint is positive, indicate an increase
        changePercent = 100; // Set to 100% increase
    } else if (lastPoint < 0) {
        // If firstPoint is zero or invalid but lastPoint is negative, indicate a decrease
        changePercent = -100; // Set to 100% decrease
    }
    
    // Handle NaN in changePercent
    if (isNaN(changePercent)) {
        changePercent = 0;
    }
    
    let direction = 'neutral';
    let strength = Math.abs(changePercent);
    
    if (changePercent >= 5) {
        direction = 'increasing';
    } else if (changePercent <= -5) {
        direction = 'decreasing';
    }
    
    return { direction, strength, changePercent };
}

// Calculate VWAP relation to price
function calculateVWAPRelation(data) {
    if (!data || data.length < 30 || !data[0].vwap) return { relation: 'neutral', days: 0 };
    
    const recentData = data.slice(-10);
    let aboveCount = 0;
    let belowCount = 0;
    
    recentData.forEach(day => {
        if (day.close > day.vwap) {
            aboveCount++;
        } else if (day.close < day.vwap) {
            belowCount++;
        }
    });
    
    let relation = 'neutral';
    if (aboveCount >= 7) {
        relation = 'above';
    } else if (belowCount >= 7) {
        relation = 'below';
    }
    
    return { relation, aboveCount, belowCount };
}

// Detect volume anomalies in the last 20 days
function detectVolumeAnomalies(data) {
    if (!data || data.length < 30) return { count: 0, anomalies: [] };
    
    const recentData = data.slice(-20);
    const anomalies = [];
    
    recentData.forEach((day, index) => {
        if (day.isVolumeAnomaly) {
            anomalies.push({
                day: index,
                date: day.date,
                volume: day.volume,
                avgVolume: day.avgVolume,
                relativeVolume: day.relativeVolume,
                priceChange: day.close > day.open ? 'up' : 'down'
            });
        }
    });
    
    return { count: anomalies.length, anomalies };
}

// Detect absorption volume patterns
function detectAbsorptionVolume(data) {
    if (!data || data.length < 30) return { count: 0, events: [] };
    
    const recentData = data.slice(-20);
    const absorptionEvents = [];
    
    recentData.forEach((day, index) => {
        if (day.isAbsorption || day.isEffortVsResult) {
            absorptionEvents.push({
                day: index,
                date: day.date,
                volume: day.volume,
                avgVolume: day.avgVolume,
                type: day.isAbsorption ? 'absorption' : 'effort-vs-result'
            });
        }
    });
    
    return { count: absorptionEvents.length, events: absorptionEvents };
}

// Create HTML for volume direction
function getVolumeDirectionHtml(volumeTrend) {
    const { direction, strength, changePercent } = volumeTrend;
    
    let className = 'neutral';
    if (direction === 'increasing') className = 'positive';
    else if (direction === 'decreasing') className = 'negative';
    
    return `
        <span class="trend-indicator ${className}">
            ${direction === 'increasing' ? '▲' : direction === 'decreasing' ? '▼' : '–'}
            ${Math.abs(changePercent).toFixed(1)}%
        </span>
    `;
}

// Create HTML for OBV trend
function getOBVTrendHtml(obvTrend) {
    const { direction, strength, changePercent } = obvTrend;
    
    let className = 'neutral';
    if (direction === 'increasing') className = 'positive';
    else if (direction === 'decreasing') className = 'negative';
    
    // Handle NaN, undefined, or zero values to ensure clean display
    let displayValue = 0;
    if (changePercent !== undefined && !isNaN(changePercent)) {
        displayValue = Math.abs(changePercent).toFixed(1);
    }
    
    // If the value is exactly 0, display as "Neutral" instead of "0%"
    if (displayValue === '0.0' || displayValue === 0) {
        return `
            <span class="trend-indicator neutral">
                Neutral
            </span>
        `;
    }
    
    return `
        <span class="trend-indicator ${className}">
            ${direction === 'increasing' ? '▲' : direction === 'decreasing' ? '▼' : '–'}
            ${displayValue}%
        </span>
    `;
}

// Create HTML for VWAP relation
function getVWAPRelationHtml(vwapRelation) {
    const { relation, aboveCount, belowCount } = vwapRelation;
    
    let className = 'neutral';
    if (relation === 'above') className = 'positive';
    else if (relation === 'below') className = 'negative';
    
    return `
        <span class="trend-indicator ${className}">
            ${relation === 'above' ? 'Above' : relation === 'below' ? 'Below' : 'Neutral'}
            (${aboveCount}/${belowCount})
        </span>
    `;
}

// Create HTML for volume anomalies
function getVolumeAnomaliesHtml(volumeAnomalies) {
    const { count, anomalies } = volumeAnomalies;
    
    if (count === 0) {
        return 'None';
    }
    
    return `
        <div class="anomaly-count">${count} anomalies</div>
        <div class="anomaly-detail">
            ${anomalies.slice(0, 2).map(a => {
                const className = a.priceChange === 'up' ? 'positive' : 'negative';
                return `<span class="anomaly-day ${className}">${formatDate(a.date)} (${a.relativeVolume.toFixed(1)}x)</span>`;
            }).join(', ')}
            ${count > 2 ? `<span>+${count - 2} more</span>` : ''}
        </div>
    `;
}

// Create HTML for absorption volume
function getAbsorptionHtml(absorption) {
    const { count, events } = absorption;
    
    if (count === 0) {
        return 'None';
    }
    
    return `
        <div class="absorption-count">${count} events</div>
        <div class="absorption-detail">
            ${events.slice(0, 2).map(e => {
                return `<span class="absorption-day">${formatDate(e.date)} (${e.type})</span>`;
            }).join(', ')}
            ${count > 2 ? `<span>+${count - 2} more</span>` : ''}
        </div>
    `;
}

// Format date as MM/DD
function formatDate(date) {
    if (!date) return '';
    
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Create pattern comparison chart
function createPatternComparisonChart(container) {
    if (!accumulationStocks.length) return;
    
    // Clear container first
    container.innerHTML = '';
    
    // Prepare data for chart
    const topStocks = accumulationStocks.slice(0, 5);
    
    // Set dimensions
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 400;
    const margin = {top: 40, right: 80, bottom: 60, left: 80};
    
    // Create SVG
    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);
    
    // X scale
    const x = d3.scaleBand()
        .domain(topStocks.map(stock => stock.symbol))
        .range([margin.left, width - margin.right])
        .padding(0.3);
    
    // Y scale
    const y = d3.scaleLinear()
        .domain([0, d3.max(topStocks, stock => stock.score) * 1.1])
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
        .call(d3.axisLeft(y));
    
    // Add Y axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", margin.left / 3)
        .attr("x", -(height / 2))
        .attr("text-anchor", "middle")
        .text("Accumulation Score");
    
    // Add bars
    svg.selectAll("rect.score-bar")
        .data(topStocks)
        .join("rect")
        .attr("class", "score-bar")
        .attr("x", d => x(d.symbol))
        .attr("y", d => y(d.score))
        .attr("width", x.bandwidth())
        .attr("height", d => height - margin.bottom - y(d.score))
        .attr("fill", d => {
            if (d.confidence === 'veryhigh') return '#2e7d32';
            if (d.confidence === 'high') return '#4caf50';
            if (d.confidence === 'medium') return '#ff9800';
            return '#f44336';
        });
    
    // Add value labels on top of bars
    svg.selectAll("text.score-label")
        .data(topStocks)
        .join("text")
        .attr("class", "score-label")
        .attr("x", d => x(d.symbol) + x.bandwidth() / 2)
        .attr("y", d => y(d.score) - 5)
        .attr("text-anchor", "middle")
        .text(d => d.score.toFixed(1));
}

function initializeStockChart(symbol, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const data = stockHistoricalData[symbol];
    if (!data || data.length < 30) return;
    
    // Clean up any existing chart
    if (chartInstances[symbol] && chartInstances[symbol].chart) {
        try {
            // Handle both D3 and LightweightCharts cleanup
            if (typeof chartInstances[symbol].chart.remove === 'function') {
                chartInstances[symbol].chart.remove();
            } else {
                // For D3, just clear the container
                container.innerHTML = '';
            }
        } catch (e) {
            console.warn(`Error cleaning up chart for ${symbol}:`, e);
            container.innerHTML = '';
        }
    }
    
    try {
        // Clear container
        container.innerHTML = '';
        
        // Use ALL available data for charts - show complete history
        // This ensures we see the full 1.5 years when available
        const displayData = data;
        
        // Get current stock from accumulation stocks if available
        const stock = accumulationStocks.find(s => s.symbol === symbol);
        
        // Safely access nested properties with proper null checks
        let supportLevel = null;
        let resistanceLevel = null;
        
        if (stock && stock.details && stock.details.wyckoff && stock.details.wyckoff.keyLevels) {
            supportLevel = stock.details.wyckoff.keyLevels.supportLevel;
            resistanceLevel = stock.details.wyckoff.keyLevels.resistanceLevel;
        }
            
        // Set up dimensions - use fixed width to prevent overflow
        const width = 200; // Fixed width to match CSS
        const height = 100; // Fixed height to match CSS
        const margin = {top: 5, right: 1, bottom: 5, left: 1};
        
        // Create SVG with fixed dimensions
        const svg = d3.select(container)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");
        
        // X scale - use index for simplicity
        const x = d3.scaleLinear()
            .domain([0, displayData.length - 1])
            .range([margin.left, width - margin.right]);
        
        // Y scale - additional safeguards for min/max values
        let minY = d3.min(displayData, d => d.low) * 0.995;
        let maxY = d3.max(displayData, d => d.high) * 1.005;
        
        // Add support and resistance levels to Y scale if they exist and are valid numbers
        if (supportLevel !== null && !isNaN(supportLevel) && supportLevel > 0) {
            minY = Math.min(minY, supportLevel * 0.995);
        }
        
        if (resistanceLevel !== null && !isNaN(resistanceLevel) && resistanceLevel > 0) {
            maxY = Math.max(maxY, resistanceLevel * 1.005);
        }
        
        // Extra safety check to ensure valid scale domain
        if (minY >= maxY) {
            minY = d3.min(displayData, d => d.low) * 0.9;
            maxY = d3.max(displayData, d => d.high) * 1.1;
        }
        
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
            .attr("stroke-width", 1.5)
            .attr("d", line);
        
        // Add support level line if available and valid
        if (supportLevel !== null && !isNaN(supportLevel) && supportLevel > 0) {
            svg.append("line")
                .attr("x1", margin.left)
                .attr("x2", width - margin.right)
                .attr("y1", y(supportLevel))
                .attr("y2", y(supportLevel))
                .attr("stroke", "#2ECC40")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "2,2");
        }
        
        // Add resistance level line if available and valid
        if (resistanceLevel !== null && !isNaN(resistanceLevel) && resistanceLevel > 0) {
            svg.append("line")
                .attr("x1", margin.left)
                .attr("x2", width - margin.right)
                .attr("y1", y(resistanceLevel))
                .attr("y2", y(resistanceLevel))
                .attr("stroke", "#FF4136")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "2,2");
        }
        
        // Add transparent overlay for click events
        svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .style("fill", "transparent")
            .style("cursor", "pointer")
            .on("click", () => {
                showFullScreenChart(symbol, stock);
            });
        
        // Store the chart instance
        chartInstances[symbol] = {
            chart: svg.node(),
            container: container
        };
        
        return svg.node();
    } catch (error) {
        console.error(`Error initializing chart for ${symbol}:`, error);
        container.innerHTML = '<div style="padding: 5px; text-align: center; font-size: 10px;">Chart error</div>';
        return null;
    }
}

function showFullScreenChart(symbol, stockData) {
    // Get the popup elements
    const popup = document.querySelector('.chart-popup');
    const popupTitle = document.getElementById('popupChartTitle');
    const popupChartContainer = document.getElementById('popupChartContainer');
    const popupDetailsContainer = document.getElementById('popupDetailsContainer');
    
    // Set the title
    popupTitle.textContent = `${symbol} Analysis`;
    
    // Clear previous content
    popupChartContainer.innerHTML = '';
    popupDetailsContainer.innerHTML = '';
    
    // Make the popup visible first, then apply the flex display
    // This approach ensures consistent centering
    popup.style.display = 'flex';
    popup.classList.add('visible');
    
    // Ensure close button works
    const closeButton = document.querySelector('.chart-popup-close');
    if (closeButton) {
        closeButton.onclick = function() {
            popup.classList.remove('visible');
            popup.style.display = 'none';
        };
    }
    
    try {
        // Get the data
        const data = stockHistoricalData[symbol];
        if (!data || data.length === 0) {
            popupChartContainer.innerHTML = '<div class="error">No data available for this stock</div>';
            return;
        }
        
        // Get the selected timeframe from the UI
        const selectedTimeframe = parseInt(document.getElementById('timeframeSelect').value) || 60;
        
        // Use more data points for detailed view:
        // - If a long timeframe is selected (365+ days), show all available data
        // - Otherwise use a reasonable amount based on the selected timeframe
        let displayDataLength;
        if (selectedTimeframe >= 365) {
            // Show all available data for long timeframes
            displayDataLength = data.length;
        } else {
            // For shorter timeframes, show 2-3x the selected timeframe or all data if less
            displayDataLength = Math.min(data.length, selectedTimeframe * 2.5);
        }
        
        const displayData = data.slice(-displayDataLength);
        
        // Set up dimensions
        const width = popupChartContainer.clientWidth || 800;
        const height = 400;
        const margin = {top: 20, right: 80, bottom: 30, left: 50};
        
        // Create SVG
        const svg = d3.select(popupChartContainer)
            .append("svg")
            .attr("width", width)
            .attr("height", height);
        
        // X scale - use index for simplicity
        const x = d3.scaleLinear()
            .domain([0, displayData.length - 1])
            .range([margin.left, width - margin.right]);
        
        // X axis with dates
        const xAxis = svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(5).tickFormat(i => {
                const index = Math.floor(i);
                if (index >= 0 && index < displayData.length) {
                    const date = displayData[index].date;
                    return date.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
                }
                return "";
            }));
        
        // Get key levels if available
        let supportLevel = null;
        let resistanceLevel = null;
        
        if (stockData && stockData.details && stockData.details.wyckoff && stockData.details.wyckoff.keyLevels) {
            supportLevel = stockData.details.wyckoff.keyLevels.supportLevel;
            resistanceLevel = stockData.details.wyckoff.keyLevels.resistanceLevel;
        }
        
        // Y scale - ensure support and resistance levels are included in the domain
        const minY = Math.min(
            d3.min(displayData, d => d.low) * 0.99,
            supportLevel ? supportLevel * 0.99 : Infinity
        );
        const maxY = Math.max(
            d3.max(displayData, d => d.high) * 1.01,
            resistanceLevel ? resistanceLevel * 1.01 : -Infinity
        );
        
        const y = d3.scaleLinear()
            .domain([minY, maxY])
            .range([height - margin.bottom, margin.top]);
        
        // Y axis
        const yAxis = svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y));
        
        // Add candlesticks
        svg.selectAll("rect.candle")
            .data(displayData)
            .enter()
            .append("rect")
            .attr("class", "candle")
            .attr("x", (d, i) => x(i) - 3)
            .attr("y", d => y(Math.max(d.open, d.close)))
            .attr("width", 6)
            .attr("height", d => Math.abs(y(d.open) - y(d.close)))
            .attr("fill", d => d.open > d.close ? "#ef5350" : "#26a69a");
        
        // Add wicks
        svg.selectAll("line.wick")
            .data(displayData)
            .enter()
            .append("line")
            .attr("class", "wick")
            .attr("x1", (d, i) => x(i))
            .attr("x2", (d, i) => x(i))
            .attr("y1", d => y(d.high))
            .attr("y2", d => y(d.low))
            .attr("stroke", d => d.open > d.close ? "#ef5350" : "#26a69a")
            .attr("stroke-width", 1);
        
        // Add support level line if available
        if (supportLevel && !isNaN(supportLevel)) {
            svg.append("line")
                .attr("x1", margin.left)
                .attr("x2", width - margin.right)
                .attr("y1", y(supportLevel))
                .attr("y2", y(supportLevel))
                .attr("stroke", "#2ECC40")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "5,5");
            
            // Add support level label
            svg.append("text")
                .attr("x", width - margin.right + 5)
                .attr("y", y(supportLevel) + 4)
                .attr("fill", "#2ECC40")
                .attr("font-size", "12px")
                .attr("text-anchor", "start")
                .text(`Support: ${supportLevel.toFixed(2)}`);
        }
        
        // Add resistance level line if available
        if (resistanceLevel && !isNaN(resistanceLevel)) {
            svg.append("line")
                .attr("x1", margin.left)
                .attr("x2", width - margin.right)
                .attr("y1", y(resistanceLevel))
                .attr("y2", y(resistanceLevel))
                .attr("stroke", "#FF4136")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "5,5");
            
            // Add resistance level label
            svg.append("text")
                .attr("x", width - margin.right + 5)
                .attr("y", y(resistanceLevel) + 4)
                .attr("fill", "#FF4136")
                .attr("font-size", "12px")
                .attr("text-anchor", "start")
                .text(`Resistance: ${resistanceLevel.toFixed(2)}`);
        }
        
        // Create detailed analysis HTML if stock data available
        if (stockData) {
            let detailsHtml = `
                <div class="details-container">
                    <h4>Accumulation Analysis for ${symbol}</h4>
                    <div class="details-score">
                        <strong>Overall Score:</strong>
                        <span class="score-indicator score-${stockData.confidence}">${stockData.score.toFixed(1)}</span>
                        <span class="confidence-level">(${capitalizeFirstLetter(stockData.confidence)} Confidence)</span>
                    </div>
                    <div class="details-patterns">
                        <strong>Detected Patterns:</strong> ${formatPatternsList(stockData.patterns)}
                    </div>
                    <div class="details-timing">
                        <strong>Days in Accumulation:</strong> ${stockData.daysInAccumulation}
                    </div>
            `;
            
            // Add pattern-specific details
            if (stockData.details.wyckoff && stockData.details.wyckoff.detected) {
                detailsHtml += `
                    <div class="pattern-section">
                        <h5>Wyckoff Analysis</h5>
                        <div><strong>Current Phase:</strong> ${stockData.details.wyckoff.phase || 'Unknown'}</div>
                        <div><strong>Days in Phase:</strong> ${stockData.details.wyckoff.daysInPhase}</div>
                        <div><strong>Key Events:</strong></div>
                        <ul>
                            ${stockData.details.wyckoff.events.map(event => `
                                <li>${event.type} (${new Date(event.date).toLocaleDateString()})</li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }
            
            if (stockData.details.vsa && stockData.details.vsa.detected) {
                detailsHtml += `
                    <div class="pattern-section">
                        <h5>Volume Spread Analysis</h5>
                        <div><strong>Volume Signature:</strong> ${stockData.volumeSignature || 'Unknown'}</div>
                        <div><strong>Detected Patterns:</strong></div>
                        <ul>
                            ${stockData.details.vsa.patterns.slice(0, 5).map(pattern => `
                                <li>${pattern.type} (${new Date(pattern.date).toLocaleDateString()})</li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }
            
            if (stockData.details.obv && stockData.details.obv.detected) {
                detailsHtml += `
                    <div class="pattern-section">
                        <h5>OBV Analysis</h5>
                        <div><strong>OBV Strength:</strong> ${stockData.details.obv.strength}</div>
                        
                        ${stockData.details.obv.divergence20 ? `
                            <div><strong>20-Day Divergence:</strong> ${stockData.details.obv.divergence20.priceChange} price vs ${stockData.details.obv.divergence20.obvChange} OBV</div>
                        ` : ''}
                        
                        ${stockData.details.obv.divergence40 ? `
                            <div><strong>40-Day Divergence:</strong> ${stockData.details.obv.divergence40.priceChange} price vs ${stockData.details.obv.divergence40.obvChange} OBV</div>
                        ` : ''}
                    </div>
                `;
            }
            
            if (stockData.details.rsi && stockData.details.rsi.detected) {
                detailsHtml += `
                    <div class="pattern-section">
                        <h5>RSI Divergence Analysis</h5>
                        <div><strong>Divergence Strength:</strong> ${stockData.details.rsi.strength}</div>
                        
                        ${stockData.details.rsi.regularDivergence && stockData.details.rsi.regularDivergence.detected ? `
                            <div><strong>Regular Divergence:</strong> Price making lower lows while RSI makes higher lows</div>
                        ` : ''}
                        
                        ${stockData.details.rsi.hiddenDivergence && stockData.details.rsi.hiddenDivergence.detected ? `
                            <div><strong>Hidden Divergence:</strong> Price making higher lows while RSI makes lower lows</div>
                        ` : ''}
                        
                        ${stockData.details.rsi.recentOversold && stockData.details.rsi.recentOversold.detected ? `
                            <div><strong>Recent Oversold:</strong> RSI went below 30 in the last 15 days</div>
                        ` : ''}
                    </div>
                `;
            }
            
            detailsHtml += `</div>`;
            
            // Add details to the container
            popupDetailsContainer.innerHTML = detailsHtml;
        }
    } catch (error) {
        console.error('Error setting up chart:', error);
        popupChartContainer.innerHTML = '<div class="error">Failed to load chart data: ' + error.message + '</div>';
    }
}

// Get appropriate color for event markers
function getEventColor(eventType) {
    switch (eventType) {
        case 'Spring':
        case 'Sign of Strength':
        case 'Last Point of Support':
            return '#2ECC40';
        case 'Selling Climax':
        case 'Secondary Test':
            return '#FF4136';
        case 'Preliminary Support':
        case 'Backup':
            return '#0074D9';
        case 'Test':
            return '#FFDC00';
        case 'Breakout':
            return '#B10DC9';
        default:
            return '#AAAAAA';
    }
}

// Get appropriate shape for event markers
function getEventShape(eventType) {
    switch (eventType) {
        case 'Spring':
            return 'arrowUp';
        case 'Selling Climax':
            return 'arrowDown';
        case 'Sign of Strength':
            return 'triangle';
        case 'Test':
        case 'Secondary Test':
            return 'circle';
        case 'Breakout':
            return 'square';
        default:
            return 'circle';
    }
}

// Manual stock analysis form
function showManualStockForm() {
    document.getElementById('manualStockForm').style.display = 'block';
    document.getElementById('manualSymbol').focus();
}

function hideManualStockForm() {
    document.getElementById('manualStockForm').style.display = 'none';
    document.getElementById('manualSymbol').value = '';
}

function saveManualStock() {
    const symbol = document.getElementById('manualSymbol').value.trim().toUpperCase();
    
    if (!symbol) {
        showError('Please enter a stock symbol');
        return;
    }
    
    // Check if we have data for this stock
    if (!stockHistoricalData[symbol]) {
        showError(`Historical data for ${symbol} is not available.`);
        return;
    }
    
    // Check if we have current price
    if (!currentPrices[symbol]) {
        showError(`Current price for ${symbol} is not available.`);
        return;
    }
    
    // Get analysis options from the UI
    const sensitivityLevel = parseInt(document.getElementById('sensitivitySlider').value) || 5;
    const timeframeDays = parseInt(document.getElementById('timeframeSelect').value) || 60;
    const useWyckoff = document.getElementById('patternWyckoff').checked;
    const useVSA = document.getElementById('patternVSA').checked;
    const useOBV = document.getElementById('patternOBV').checked;
    const useRSI = document.getElementById('patternRSI').checked;
    const useMultiTimeframe = document.getElementById('multiTimeframeToggle').checked;
    const rsiPeriod = parseInt(document.getElementById('rsiPeriod').value) || 14;
    const obvSensitivity = parseInt(document.getElementById('obvSensitivity').value) || 5;
    
    // Set thresholds
    const thresholds = {
        consolidation: 0.15 - (sensitivityLevel * 0.01),
        obvDrift: 0.2 - (sensitivityLevel * 0.015),
        rsiDivergence: 0.15 - (sensitivityLevel * 0.01),
        volumeAnomaly: 2.0 + (sensitivityLevel * 0.2),
        scoringThreshold: {
            low: 10,
            medium: 20,
            high: 30,
            veryhigh: 40
        }
    };
    
    const options = {
        timeframeDays,
        sensitivityLevel,
        useWyckoff,
        useVSA,
        useOBV,
        useRSI,
        useMultiTimeframe,
        rsiPeriod,
        obvSensitivity,
        thresholds
    };
    
    // Analyze the stock
    const data = stockHistoricalData[symbol];
    const currentPrice = currentPrices[symbol];
    const analysis = analyzeAccumulationPatterns(symbol, data, currentPrice, options);
    
    // Hide the form
    hideManualStockForm();
    
    // Show the analysis regardless of score
    showFullScreenChart(symbol, analysis);
    
    // Add to results if it meets minimum score
    if (analysis.score >= thresholds.scoringThreshold.low) {
        const isNew = isNewlyIdentified(symbol, analysis.patterns);
        
        // Check if this stock is already in results
        const existingIndex = accumulationStocks.findIndex(s => s.symbol === symbol);
        
        if (existingIndex !== -1) {
            // Update existing entry
            accumulationStocks[existingIndex] = {
                ...analysis,
                isNew
            };
        } else {
            // Add new entry
            accumulationStocks.push({
                ...analysis,
                isNew
            });
        }
        
        // Re-sort the results
        accumulationStocks.sort((a, b) => b.score - a.score);
        
        // Refresh display
        displayAccumulationStocks();
        
        showSuccess(`${symbol} has been analyzed and added to results`);
    } else {
        showSuccess(`${symbol} has been analyzed but did not meet minimum score threshold`);
    }
}

// Load filter settings from localStorage
function loadFilterSettings() {
    try {
        // Get settings from localStorage
        const savedTimeframe = localStorage.getItem('accumulationTimeframe');
        const savedSensitivity = localStorage.getItem('accumulationSensitivity');
        const savedConfidence = localStorage.getItem('accumulationConfidence');
        const savedPatternWyckoff = localStorage.getItem('accumulationPatternWyckoff');
        const savedPatternVSA = localStorage.getItem('accumulationPatternVSA');
        const savedPatternOBV = localStorage.getItem('accumulationPatternOBV');
        const savedPatternRSI = localStorage.getItem('accumulationPatternRSI');
        const savedMultiTimeframe = localStorage.getItem('accumulationMultiTimeframe');
        const savedRSIPeriod = localStorage.getItem('accumulationRSIPeriod');
        const savedOBVSensitivity = localStorage.getItem('accumulationOBVSensitivity');
        
        // Apply saved settings if available
        if (savedTimeframe) document.getElementById('timeframeSelect').value = savedTimeframe;
        if (savedSensitivity) document.getElementById('sensitivitySlider').value = savedSensitivity;
        if (savedConfidence) document.getElementById('minConfidenceSelect').value = savedConfidence;
        if (savedPatternWyckoff) document.getElementById('patternWyckoff').checked = savedPatternWyckoff === 'true';
        if (savedPatternVSA) document.getElementById('patternVSA').checked = savedPatternVSA === 'true';
        if (savedPatternOBV) document.getElementById('patternOBV').checked = savedPatternOBV === 'true';
        if (savedPatternRSI) document.getElementById('patternRSI').checked = savedPatternRSI === 'true';
        if (savedMultiTimeframe) document.getElementById('multiTimeframeToggle').checked = savedMultiTimeframe === 'true';
        if (savedRSIPeriod) document.getElementById('rsiPeriod').value = savedRSIPeriod;
        if (savedOBVSensitivity) document.getElementById('obvSensitivity').value = savedOBVSensitivity;
    } catch (error) {
        console.error('Error loading filter settings:', error);
    }
}

// Save filter settings to localStorage
function saveFilterSettings() {
    try {
        // Get current values
        const timeframe = document.getElementById('timeframeSelect').value;
        const sensitivity = document.getElementById('sensitivitySlider').value;
        const confidence = document.getElementById('minConfidenceSelect').value;
        const patternWyckoff = document.getElementById('patternWyckoff').checked;
        const patternVSA = document.getElementById('patternVSA').checked;
        const patternOBV = document.getElementById('patternOBV').checked;
        const patternRSI = document.getElementById('patternRSI').checked;
        const multiTimeframe = document.getElementById('multiTimeframeToggle').checked;
        const rsiPeriod = document.getElementById('rsiPeriod').value;
        const obvSensitivity = document.getElementById('obvSensitivity').value;
        
        // Save to localStorage
        localStorage.setItem('accumulationTimeframe', timeframe);
        localStorage.setItem('accumulationSensitivity', sensitivity);
        localStorage.setItem('accumulationConfidence', confidence);
        localStorage.setItem('accumulationPatternWyckoff', patternWyckoff);
        localStorage.setItem('accumulationPatternVSA', patternVSA);
        localStorage.setItem('accumulationPatternOBV', patternOBV);
        localStorage.setItem('accumulationPatternRSI', patternRSI);
        localStorage.setItem('accumulationMultiTimeframe', multiTimeframe);
        localStorage.setItem('accumulationRSIPeriod', rsiPeriod);
        localStorage.setItem('accumulationOBVSensitivity', obvSensitivity);
    } catch (error) {
        console.error('Error saving filter settings:', error);
    }
}

// Show error message
function showError(message) {
    const messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) return;
    
    messageContainer.innerHTML = `<div class="error-message">${message}</div>`;
    
    // Clear the message after 3 seconds
    setTimeout(() => {
        messageContainer.innerHTML = '';
    }, 3000);
}

// Show success message
function showSuccess(message) {
    const messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) return;
    
    messageContainer.innerHTML = `<div class="success-message">${message}</div>`;
    
    // Clear the message after 3 seconds
    setTimeout(() => {
        messageContainer.innerHTML = '';
    }, 3000);
}

// Show or hide loading indicator
function showLoading(isLoading) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = isLoading ? 'block' : 'none';
    } else {
        // Create loading indicator if it doesn't exist
        if (isLoading) {
            const indicator = document.createElement('div');
            indicator.id = 'loadingIndicator';
            indicator.className = 'loading-indicator';
            indicator.innerHTML = '<div class="loading-spinner"></div><div class="loading-text">Loading...</div>';
            
            // Add styles for the loading indicator
            const style = document.createElement('style');
            style.textContent = `
                .loading-indicator {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                }
                .loading-spinner {
                    width: 50px;
                    height: 50px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                .loading-text {
                    color: white;
                    margin-top: 10px;
                    font-size: 16px;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(indicator);
        }
    }
}

// Check if a stock is in the watchlist
function isInWatchlist(symbol) {
    // First check if the common function exists (added by dashboard)
    if (typeof window.isInWatchlist === 'function' && window.isInWatchlist !== isInWatchlist) {
        return window.isInWatchlist(symbol);
    }
    
    // Fallback implementation
    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    return userStocks.some(stock => stock.symbol === symbol && stock.watchlist === true);
}

// Function to toggle watchlist status (for compatibility with other pages)
function toggleWatchlist(symbol) {
    // First check if the common function exists (added by dashboard)
    if (typeof window.toggleWatchlist === 'function' && window.toggleWatchlist !== toggleWatchlist) {
        window.toggleWatchlist(symbol);
        return;
    }
    
    // Fallback implementation
    const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    const index = watchlist.indexOf(symbol);
    
    if (index === -1) {
        // Add to watchlist
        watchlist.push(symbol);
        showSuccess(`${symbol} added to watchlist`);
    } else {
        // Remove from watchlist
        watchlist.splice(index, 1);
        showSuccess(`${symbol} removed from watchlist`);
    }
    
    // Save updated watchlist
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    
    // Update UI
    const watchlistButtons = document.querySelectorAll(`.watchlist-btn[data-watchlist="${symbol}"]`);
    watchlistButtons.forEach(button => {
        if (index === -1) {
            button.classList.add('active');
            button.innerHTML = '★';
            button.title = 'Remove from Watchlist';
        } else {
            button.classList.remove('active');
            button.innerHTML = '☆';
            button.title = 'Add to Watchlist';
        }
    });
    
    // Update row styling
    const stockRows = document.querySelectorAll(`tr[data-symbol="${symbol}"]`);
    stockRows.forEach(row => {
        if (index === -1) {
            row.classList.add('watchlist-item');
        } else {
            row.classList.remove('watchlist-item');
        }
    });
    
    // Also update userStocks for compatibility
    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    const stockIndex = userStocks.findIndex(stock => stock.symbol === symbol);
    
    if (stockIndex !== -1) {
        userStocks[stockIndex].watchlist = index === -1;
        localStorage.setItem('userStocks', JSON.stringify(userStocks));
    }
}

// Add styles for watchlisted items
function addWatchlistStyles() {
    // Add styles if they don't exist
    if (!document.getElementById('watchlistStyles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'watchlistStyles';
        styleSheet.textContent = `
            .watchlist-item {
                background-color: rgba(255, 248, 225, 0.2) !important;
            }
            .watchlist-btn {
                background-color: #FFFFFF;
                border: 1px solid #DDDDDD;
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 14px;
            }
            .watchlist-btn.active {
                background-color: #FFC107;
                color: #333;
                border-color: #FFA000;
            }
            .watchlist-btn:hover {
                background-color: #F5F5F5;
            }
            .watchlist-btn.active:hover {
                background-color: #FFD740;
            }
        `;
        document.head.appendChild(styleSheet);
    }
}

// Format pattern names for display
function formatPatternsList(patterns) {
    if (!patterns || patterns.length === 0) return 'None';
    return patterns.join(', ');
}

// Helper function to get first letter uppercase
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Downsample data for charts to avoid performance issues
function downsampleData(data, threshold = 200) {
    if (!data || data.length <= threshold) return data;
    
    const factor = Math.ceil(data.length / threshold);
    return data.filter((_, i) => i % factor === 0);
}

// Helper function to ensure mini charts are clickable
function setupChartClickEvents() {
    document.querySelectorAll('.chart-container-small').forEach(container => {
        if (!container.getAttribute('data-click-initialized')) {
            container.addEventListener('click', () => {
                const symbol = container.getAttribute('data-symbol');
                if (symbol) {
                    const stock = accumulationStocks.find(s => s.symbol === symbol);
                    showFullScreenChart(symbol, stock);
                }
            });
            container.setAttribute('data-click-initialized', 'true');
        }
    });
}

// Function to refresh all data
function refreshData() {
    console.log("Refreshing data...");
    
    // Show loading state
    if (typeof showLoading === 'function') {
        showLoading(true);
    }
    
    // Fetch historical data first to ensure we have the base data
    fetchHistoricalData().then(() => {
        // Then load current prices - this doesn't return a Promise, so call it directly
        loadCurrentPrices();
        
        // These functions are called inside loadCurrentPrices already, but call them
        // again to be safe in case loadCurrentPrices found cached data
        detectAccumulationPatterns();
        updateBuyCandidates();
        
        // Hide loading state - this may be redundant as loadCurrentPrices also calls showLoading(false)
        if (typeof showLoading === 'function') {
            showLoading(false);
        }
    }).catch(error => {
        console.error("Error refreshing historical data:", error);
        
        // Try to continue with available data - call directly without expecting a Promise
        loadCurrentPrices();
        
        // Make sure we detect patterns and update buy candidates
        // These should already be called from within loadCurrentPrices, but call again to be safe
        detectAccumulationPatterns();
        updateBuyCandidates();
        
        // Hide loading state - may be redundant
        if (typeof showLoading === 'function') {
            showLoading(false);
        }
    });
}

// Function to show/hide loading indicator
function showLoading(isLoading) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = isLoading ? 'block' : 'none';
    } else {
        // Create loading indicator if it doesn't exist
        if (isLoading) {
            const indicator = document.createElement('div');
            indicator.id = 'loadingIndicator';
            indicator.className = 'loading-indicator';
            indicator.innerHTML = '<div class="loading-spinner"></div><div class="loading-text">Loading...</div>';
            
            // Add styles for the loading indicator
            const style = document.createElement('style');
            style.textContent = `
                .loading-indicator {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                }
                .loading-spinner {
                    width: 50px;
                    height: 50px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                .loading-text {
                    color: white;
                    margin-top: 10px;
                    font-size: 16px;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(indicator);
        }
    }
}

// Function to toggle watchlist status for a specific stock in the accumulation table
function toggleWatchlistStock(index) {
    const stock = accumulationStocks[index];
    if (!stock) return;
    
    const symbol = stock.symbol;
    
    // Use the global toggleWatchlist function if it exists
    if (typeof window.toggleWatchlist === 'function' && window.toggleWatchlist !== toggleWatchlist) {
        window.toggleWatchlist(symbol);
    } else {
        // Otherwise use our local implementation
        toggleWatchlist(symbol);
    }
    
    // Update display to reflect changes
    displayAccumulationStocks();
}

// Create volume analysis charts
function createVolumeAnalysisCharts(container) {
    if (!accumulationStocks.length) return;
    
    // Clear container first
    container.innerHTML = '';
    
    // Prepare data for chart - get top stocks by volume anomaly count
    const volumeData = accumulationStocks.slice(0, 10).map(stock => {
        // Get historical data
        const data = stockHistoricalData[stock.symbol];
        if (!data) return null;
        
        // Calculate volume metrics
        const volumeAnomalies = detectVolumeAnomalies(data);
        const absorption = detectAbsorptionVolume(data);
        
        return {
            symbol: stock.symbol,
            volumeAnomalies: volumeAnomalies.count,
            absorption: absorption.count,
            score: stock.score
        };
    }).filter(d => d !== null);
    
    // Sort by volume anomalies
    volumeData.sort((a, b) => b.volumeAnomalies - a.volumeAnomalies);
    
    // Take top 10
    const topStocks = volumeData.slice(0, 10);
    
    // Set dimensions
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 400;
    const margin = {top: 40, right: 80, bottom: 60, left: 80};
    
    // Create SVG
    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);
    
    // X scale
    const x = d3.scaleBand()
        .domain(topStocks.map(d => d.symbol))
        .range([margin.left, width - margin.right])
        .padding(0.2);
    
    // Y scale
    const y = d3.scaleLinear()
        .domain([0, d3.max(topStocks, d => Math.max(d.volumeAnomalies, d.absorption)) * 1.1])
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
        .call(d3.axisLeft(y).ticks(5));
    
    // Add Y axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", margin.left / 3)
        .attr("x", -(height / 2))
        .attr("text-anchor", "middle")
        .text("Count");
    
    // Calculate bar width
    const barWidth = x.bandwidth() / 2;
    
    // Add volume anomaly bars
    svg.selectAll("rect.anomaly-bar")
        .data(topStocks)
        .join("rect")
        .attr("class", "anomaly-bar")
        .attr("x", d => x(d.symbol))
        .attr("y", d => y(d.volumeAnomalies))
        .attr("width", barWidth)
        .attr("height", d => height - margin.bottom - y(d.volumeAnomalies))
        .attr("fill", "#ff9800");
    
    // Add absorption bars
    svg.selectAll("rect.absorption-bar")
        .data(topStocks)
        .join("rect")
        .attr("class", "absorption-bar")
        .attr("x", d => x(d.symbol) + barWidth)
        .attr("y", d => y(d.absorption))
        .attr("width", barWidth)
        .attr("height", d => height - margin.bottom - y(d.absorption))
        .attr("fill", "#2196f3");
    
    // Add legend
    const legend = svg.append("g")
        .attr("transform", `translate(${width - margin.right + 10}, ${margin.top})`);
    
    // Volume anomalies legend
    legend.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", "#ff9800");
    
    legend.append("text")
        .attr("x", 20)
        .attr("y", 12)
        .text("Volume Anomalies")
        .style("font-size", "12px");
    
    // Absorption legend
    legend.append("rect")
        .attr("x", 0)
        .attr("y", 25)
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", "#2196f3");
    
    legend.append("text")
        .attr("x", 20)
        .attr("y", 37)
        .text("Absorption Events")
        .style("font-size", "12px");
}
