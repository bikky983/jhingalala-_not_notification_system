// Global variables
let userStocks = [];
let currentPrices = {};
let stockHistoricalData = {};
let institutionalActivityData = [];
let chartInstances = {};
let boughtStocks = [];
let autoRefreshInterval = null;

// Constants for detection
const VOLUME_ANOMALY_THRESHOLD = 2.0; // 2x average volume
const OBV_DIVERGENCE_THRESHOLD = 0.15; // 15% divergence
const VWAP_DEVIATION_THRESHOLD = 0.03; // 3% deviation
const MIN_DATA_POINTS = 50; // Minimum historical data points needed

document.addEventListener('DOMContentLoaded', function() {
    // Initialize tabs
    setupTabNavigation();
    
    // Create chart popup
    createChartPopup();
    
    // Load user stocks
    loadUserStocks();
    
    // Setup event listeners
    setupEventListeners();
    
    // Fetch historical data
    fetchHistoricalData();
    
    // Add timeframe change listeners for pattern detection
    document.querySelectorAll('.timeframe-option').forEach(option => {
        option.addEventListener('click', function() {
            const timeframe = this.getAttribute('data-timeframe');
            if (timeframe) {
                document.querySelectorAll('.timeframe-option').forEach(opt => opt.classList.remove('active'));
                this.classList.add('active');
                patternTimeframe = timeframe;
                updatePatternAnalysisChart();
            }
        });
    });
    
    // Add volume analysis option listeners
    document.querySelectorAll('.volume-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.volume-option').forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            
            // Update the chart based on the selected option
            updateVolumeAnalysis();
        });
    });
    
    // Add threshold change listeners
    document.getElementById('volumeThreshold')?.addEventListener('change', updateVolumeAnalysis);
    document.getElementById('obvThreshold')?.addEventListener('change', updatePatternAnalysisChart);
    document.getElementById('manipulationThreshold')?.addEventListener('change', detectInstitutionalActivity);
    
    // Initialize volume analysis
    updateVolumeAnalysis();
    
    // Initialize tab change listeners
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            if (tabId) {
                switchTab(tabId);
            }
        });
    });
    
    // Initial detection will happen after data is loaded
    console.log('Institutional Activity Detector initialized');
});

function initializePage() {
    loadUserStocks();
    loadCurrentPrices();
    detectInstitutionalActivity();
}

function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadCurrentPrices();
            fetchHistoricalData();
        });
    }
    
    // Stock search functionality
    const searchInput = document.getElementById('stockSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            filterActivityTable(searchTerm);
        });
    }
    
    // Auto-refresh toggle
    const autoRefreshBtn = document.getElementById('autoRefreshBtn');
    if (autoRefreshBtn) {
        const isAutoRefreshEnabled = localStorage.getItem('autoRefreshEnabled') === 'true';
        autoRefreshBtn.textContent = isAutoRefreshEnabled ? 'Disable Auto Refresh' : 'Enable Auto Refresh';
        autoRefreshBtn.addEventListener('click', toggleAutoRefresh);
    }
    
    // Manual stock entry
    const addManualStockBtn = document.getElementById('addManualStockBtn');
    if (addManualStockBtn) {
        addManualStockBtn.addEventListener('click', showManualStockForm);
    }
    
    const saveManualStockBtn = document.getElementById('saveManualStockBtn');
    if (saveManualStockBtn) {
        saveManualStockBtn.addEventListener('click', saveManualStock);
    }
    
    const cancelManualStockBtn = document.getElementById('cancelManualStockBtn');
    if (cancelManualStockBtn) {
        cancelManualStockBtn.addEventListener('click', hideManualStockForm);
    }
    
    // Filter settings
    const filterInputs = document.querySelectorAll('.filter-group input[type="checkbox"]');
    filterInputs.forEach(input => {
        input.addEventListener('change', detectInstitutionalActivity);
    });
    
    const minScoreThreshold = document.getElementById('minScoreThreshold');
    if (minScoreThreshold) {
        minScoreThreshold.addEventListener('change', detectInstitutionalActivity);
    }
    
    // Pattern tab filters
    const patternFilters = document.querySelectorAll('#patternsContent input[type="checkbox"]');
    patternFilters.forEach(input => {
        input.addEventListener('change', updatePatternAnalysis);
    });
    
    const patternTimeframe = document.getElementById('patternTimeframe');
    if (patternTimeframe) {
        patternTimeframe.addEventListener('change', updatePatternAnalysis);
    }
    
    // Volume tab filters
    const volumeFilters = document.querySelectorAll('#volumeContent input[type="checkbox"]');
    volumeFilters.forEach(input => {
        input.addEventListener('change', updateVolumeAnalysis);
    });
    
    const volumeThreshold = document.getElementById('volumeThreshold');
    if (volumeThreshold) {
        volumeThreshold.addEventListener('change', updateVolumeAnalysis);
    }
    
    // Tab navigation
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            if (tabId) {
                const tabs = document.querySelectorAll('.tab');
                const contents = document.querySelectorAll('.tab-content');
                
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                
                this.classList.add('active');
                document.getElementById(`${tabId}Content`).classList.add('active');
                
                if (tabId === 'patterns') {
                    updatePatternAnalysis();
                } else if (tabId === 'volume') {
                    updateVolumeAnalysis();
                }
            }
        });
    });
    
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
        
        // Update current tab content
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            const tabId = activeTab.getAttribute('data-tab');
            if (tabId === 'patterns') {
                updatePatternAnalysis();
            } else if (tabId === 'volume') {
                updateVolumeAnalysis();
            }
        }
    });
    
    console.log('Event listeners set up');
}

// Filter the activity table based on search term
function filterActivityTable(searchTerm) {
    const table = document.getElementById('activityTable');
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const symbol = row.cells[0].textContent.toLowerCase();
        const patterns = row.querySelector('.indicator-list')?.textContent.toLowerCase() || '';
        
        if (searchTerm === '' || symbol.includes(searchTerm) || patterns.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
    
    // If no visible rows after filtering, show a message
    const visibleRows = Array.from(rows).filter(row => row.style.display !== 'none');
    const noResultsRow = table.querySelector('.no-results-row');
    
    if (visibleRows.length === 0 && searchTerm !== '') {
        // If no results message doesn't exist, create it
        if (!noResultsRow) {
            const tbody = table.querySelector('tbody');
            const tr = document.createElement('tr');
            tr.className = 'no-results-row';
            tr.innerHTML = `
                <td colspan="8" class="no-data-message">
                    No stocks matching "${searchTerm}" found. Try a different search term.
                </td>
            `;
            tbody.appendChild(tr);
        } else {
            noResultsRow.style.display = '';
            noResultsRow.querySelector('td').textContent = `No stocks matching "${searchTerm}" found. Try a different search term.`;
        }
    } else if (noResultsRow) {
        // Hide no results message if we have results
        noResultsRow.style.display = 'none';
    }
}

function setupTabNavigation() {
    const tabs = document.querySelectorAll('.tab');
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
            
            // Update tab content
            if (tabId === 'patterns') {
                updatePatternAnalysis();
            } else if (tabId === 'volume') {
                updateVolumeAnalysis();
            }
        });
    });
}

function createChartPopup() {
    const popupElement = document.createElement('div');
    popupElement.className = 'chart-popup';
    popupElement.style.display = 'none';
    popupElement.innerHTML = `
        <div class="chart-popup-content">
            <div class="chart-popup-header">
                <h3 id="popupChartTitle">Stock Analysis</h3>
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
    
    // Add event listener to close when clicking outside the chart content
    popupElement.addEventListener('click', (event) => {
        // Only close if clicking the background (not the content)
        if (event.target === popupElement) {
            popupElement.style.display = 'none';
        }
    });
    
    console.log('Chart popup created');
}

// Part 2: Data loading and stock analysis functions

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
            detectInstitutionalActivity();
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
        
        detectInstitutionalActivity();
        showLoading(false);
        return prices;
    } catch (error) {
        console.error('Error fetching prices from API:', error);
        showError('Failed to fetch prices from API');
        showLoading(false);
        return {};
    }
}

async function fetchHistoricalData() {
    try {
        showLoading(true, 'Fetching historical data...');
        console.log('Fetching historical data...');
        
        // Attempt to fetch from organized_nepse_data.json in the public folder
        const response = await fetch('/organized_nepse_data.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log('Historical data fetched, parsing JSON...');
        showLoading(true, 'Parsing data...');
        const data = await response.json();
        console.log('Data parsed, processing...');
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            throw new Error('Invalid or empty data format');
        }
        
        // Process the data
        showLoading(true, 'Processing stock data...');
        processHistoricalData(data);
        
        // After processing, detect institutional activity
        console.log('Detecting institutional activity...');
        showLoading(true, 'Analyzing for institutional activity...');
        detectInstitutionalActivity();
        
        showLoading(false);
        showSuccess('Stock data loaded successfully');
    } catch (error) {
        console.error('Error fetching historical data:', error);
        showError(`Failed to load historical price data. Reason: ${error.message}`);
        showLoading(false);
        
        // Try using mock data for testing
        console.log('Falling back to mock data for testing...');
        showLoading(true, 'Using test data for demonstration...');
        useMockDataForTesting();
        
        // Suggest to the user what might be wrong
        if (error.message.includes('404')) {
            showError('organized_nepse_data.json file not found. Please make sure it exists in the public folder.');
        } else if (error.message.includes('parse')) {
            showError('JSON parsing error. The data file may be corrupted.');
        }
    }
}

function processHistoricalData(data) {
    stockHistoricalData = {};
    
    // Group data by symbol
    data.forEach(item => {
        const symbol = item.symbol;
        
        if (!stockHistoricalData[symbol]) {
            stockHistoricalData[symbol] = [];
        }
        
        stockHistoricalData[symbol].push({
            date: new Date(item.date),
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volume
        });
    });
    
    // Sort data by date (oldest to newest)
    Object.keys(stockHistoricalData).forEach(symbol => {
        stockHistoricalData[symbol].sort((a, b) => a.date - b.date);
        
        // Calculate additional indicators
        calculateIndicators(stockHistoricalData[symbol]);
    });
    
    console.log(`Processed historical data for ${Object.keys(stockHistoricalData).length} symbols`);
}

function calculateIndicators(data) {
    if (!data || data.length < 20) return;
    
    // Calculate OBV (On-Balance Volume)
    let obv = 0;
    data[0].obv = 0;
    
    for (let i = 1; i < data.length; i++) {
        if (data[i].close > data[i-1].close) {
            obv += data[i].volume;
        } else if (data[i].close < data[i-1].close) {
            obv -= data[i].volume;
        }
        data[i].obv = obv;
    }
    
    // Calculate VWAP (Volume-Weighted Average Price)
    let cumulativeTPV = 0; // Typical Price × Volume
    let cumulativeVolume = 0;
    
    for (let i = 0; i < data.length; i++) {
        const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
        cumulativeTPV += typicalPrice * data[i].volume;
        cumulativeVolume += data[i].volume;
        data[i].vwap = cumulativeTPV / cumulativeVolume;
    }
    
    // Calculate average volume (20-day)
    const volumePeriod = 20;
    for (let i = 0; i < data.length; i++) {
        if (i < volumePeriod - 1) {
            data[i].avgVolume = null;
            data[i].relativeVolume = null;
        } else {
            let sumVolume = 0;
            for (let j = 0; j < volumePeriod; j++) {
                sumVolume += data[i - j].volume;
            }
            data[i].avgVolume = sumVolume / volumePeriod;
            data[i].relativeVolume = data[i].volume / data[i].avgVolume;
        }
    }
    
    // Calculate price anomalies
    calculatePriceAnomalies(data);
}

function calculatePriceAnomalies(data) {
    if (!data || data.length < 30) return;
    
    // Calculate standard deviation of price changes
    const period = 30;
    
    for (let i = period; i < data.length; i++) {
        let priceChanges = [];
        
        for (let j = i - period + 1; j <= i; j++) {
            const prevClose = data[j-1].close;
            const change = (data[j].close - prevClose) / prevClose;
            priceChanges.push(change);
        }
        
        // Calculate mean
        const mean = priceChanges.reduce((sum, val) => sum + val, 0) / period;
        
        // Calculate standard deviation
        const variance = priceChanges.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        
        // Current price change
        const prevClose = data[i-1].close;
        const currentChange = (data[i].close - prevClose) / prevClose;
        
        // Z-score (how many standard deviations from mean)
        data[i].priceZScore = Math.abs(currentChange - mean) / (stdDev || 0.001);
        
        // Anomaly detection
        data[i].isPriceAnomaly = data[i].priceZScore > 2.0; // 2 standard deviations
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
        
        // Generate 100 days of data
        for (let i = 0; i < 100; i++) {
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
            
            // Create data point
            data.push({
                date: new Date(2023, 0, i + 1),
                open: price - Math.random() * 5,
                high: price + Math.random() * 8,
                low: price - Math.random() * 8,
                close: price,
                volume: dailyVolume,
                obv: obv
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
    
    // Detect institutional activity with mock data
    detectInstitutionalActivity();
    
    showSuccess('Using test data for demonstration');
}

function setupAutoRefresh() {
    clearInterval(autoRefreshInterval);
    
    const isAutoRefreshEnabled = localStorage.getItem('autoRefreshEnabled') === 'true';
    if (isAutoRefreshEnabled) {
        // Refresh prices every 60 seconds
        autoRefreshInterval = setInterval(() => {
            loadCurrentPrices();
            detectInstitutionalActivity();
        }, 60000);
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

// Part 3: Institutional activity detection and display

function detectInstitutionalActivity() {
    showLoading(true);
    institutionalActivityData = [];
    
    // Get enabled detection methods
    const useVolume = document.getElementById('useVolume')?.checked || true;
    const useObv = document.getElementById('useObv')?.checked || true;
    const useVolumeSpread = document.getElementById('useVolumeSpread')?.checked || true;
    const useVwap = document.getElementById('useVwap')?.checked || true;
    const useWyckoff = document.getElementById('useWyckoff')?.checked || true;
    const usePriceAction = document.getElementById('usePriceAction')?.checked || true;
    const useAnomaly = document.getElementById('useAnomaly')?.checked || true;
    
    // Get minimum score threshold
    const minScoreThreshold = parseFloat(document.getElementById('minScoreThreshold')?.value || '0.65');
    
    // Process each stock
    userStocks.forEach(stock => {
        const symbol = stock.symbol;
        const currentPrice = currentPrices[symbol] || 0;
        if (currentPrice <= 0) return;
        
        // Get historical data for this stock
        const historicalData = stockHistoricalData[symbol];
        if (!historicalData || historicalData.length < MIN_DATA_POINTS) return; // Skip if not enough data
        
        // Analyze for institutional activity
        const analysis = analyzeInstitutionalActivity(symbol, historicalData, currentPrice, {
            useVolume, useObv, useVolumeSpread, useVwap, useWyckoff, usePriceAction, useAnomaly
        });
        
        // Only include stocks that meet the minimum threshold for any score
        if (analysis.accumulationScore >= minScoreThreshold || 
            analysis.distributionScore >= minScoreThreshold || 
            analysis.manipulationScore >= minScoreThreshold) {
            
            institutionalActivityData.push({
                symbol,
                currentPrice,
                ...analysis
            });
        }
    });
    
    // Sort by highest score (either accumulation or distribution)
    institutionalActivityData.sort((a, b) => {
        const maxScoreA = Math.max(a.accumulationScore, a.distributionScore);
        const maxScoreB = Math.max(b.accumulationScore, b.distributionScore);
        return maxScoreB - maxScoreA;
    });
    
    // Display the results
    displayInstitutionalActivity();
    
    showLoading(false);
}

function analyzeInstitutionalActivity(symbol, data, currentPrice, options) {
    const recentData = data.slice(-30); // Focus on recent 30 days
    
    // Initialize analysis object
    const analysis = {
        accumulationScore: 0,
        distributionScore: 0,
        manipulationScore: 0,
        detectedPatterns: [],
        volumeTrend: 'Normal'
    };
    
    // Get the latest data point
    const latest = recentData[recentData.length - 1];
    const prevData = recentData[recentData.length - 2];
    
    // 1. Volume Analysis
    if (options.useVolume) {
        // Check for volume spikes
        if (latest.relativeVolume > VOLUME_ANOMALY_THRESHOLD) {
            // High volume with price increase -> accumulation
            if (latest.close > prevData.close) {
                analysis.accumulationScore += 0.2;
                analysis.detectedPatterns.push('Volume Spike (Bullish)');
            } 
            // High volume with price decrease -> distribution
            else if (latest.close < prevData.close) {
                analysis.distributionScore += 0.2;
                analysis.detectedPatterns.push('Volume Spike (Bearish)');
            }
        }
        
        // Check for volume trend
        const recentVolumes = recentData.slice(-5).map(d => d.volume);
        const avgRecent = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
        const prevVolumes = recentData.slice(-10, -5).map(d => d.volume);
        const avgPrev = prevVolumes.reduce((sum, vol) => sum + vol, 0) / prevVolumes.length;
        
        if (avgRecent > avgPrev * 1.5) {
            analysis.volumeTrend = 'Increasing';
        } else if (avgRecent < avgPrev * 0.75) {
            analysis.volumeTrend = 'Decreasing';
        } else {
            analysis.volumeTrend = 'Stable';
        }
    }
    
    // 2. OBV Analysis
    if (options.useObv) {
        // Check for OBV divergence
        const priceChange = (latest.close - recentData[0].close) / recentData[0].close;
        const obvChange = (latest.obv - recentData[0].obv) / Math.abs(recentData[0].obv || 1);
        
        // Bullish divergence: Price down, OBV up (accumulation)
        if (priceChange < 0 && obvChange > OBV_DIVERGENCE_THRESHOLD) {
            analysis.accumulationScore += 0.25;
            analysis.detectedPatterns.push('OBV Bullish Divergence');
        }
        
        // Bearish divergence: Price up, OBV down (distribution)
        if (priceChange > 0 && obvChange < -OBV_DIVERGENCE_THRESHOLD) {
            analysis.distributionScore += 0.25;
            analysis.detectedPatterns.push('OBV Bearish Divergence');
        }
    }
    
    // 3. Volume Spread Analysis
    if (options.useVolumeSpread) {
        // Check for high volume with narrow price range
        const averageRange = recentData.reduce((sum, d) => sum + (d.high - d.low), 0) / recentData.length;
        const latestRange = latest.high - latest.low;
        
        if (latest.volume > latest.avgVolume * 1.5 && latestRange < averageRange * 0.7) {
            // Price up with narrow range -> accumulation
            if (latest.close > prevData.close) {
                analysis.accumulationScore += 0.15;
                analysis.detectedPatterns.push('Narrow Range, High Volume (Bullish)');
            }
            // Price down with narrow range -> distribution
            else if (latest.close < prevData.close) {
                analysis.distributionScore += 0.15;
                analysis.detectedPatterns.push('Narrow Range, High Volume (Bearish)');
            }
        }
    }
    
    // 4. VWAP Analysis
    if (options.useVwap) {
        // Calculate deviation from VWAP
        const vwapDeviation = (latest.close - latest.vwap) / latest.vwap;
        
        // Significant deviation from VWAP can indicate manipulation
        if (Math.abs(vwapDeviation) > VWAP_DEVIATION_THRESHOLD) {
            analysis.manipulationScore += 0.2;
            
            if (vwapDeviation > 0) {
                analysis.detectedPatterns.push('Above VWAP');
            } else {
                analysis.detectedPatterns.push('Below VWAP');
            }
        }
    }
    
    // 5. Wyckoff Pattern Detection
    if (options.useWyckoff) {
        // Detect accumulation patterns
        if (detectWyckoffAccumulation(recentData)) {
            analysis.accumulationScore += 0.3;
            analysis.detectedPatterns.push('Wyckoff Accumulation');
        }
        
        // Detect distribution patterns
        if (detectWyckoffDistribution(recentData)) {
            analysis.distributionScore += 0.3;
            analysis.detectedPatterns.push('Wyckoff Distribution');
        }
    }
    
    // 6. Price Action Analysis
    if (options.usePriceAction) {
        // Check for stopping volume
        if (latest.volume > latest.avgVolume * 2 && 
            Math.abs(latest.close - latest.open) < (latest.high - latest.low) * 0.3) {
            
            if (latest.close > prevData.close) {
                analysis.manipulationScore += 0.15;
                analysis.detectedPatterns.push('Stopping Volume (Bullish)');
            } else {
                analysis.manipulationScore += 0.15;
                analysis.detectedPatterns.push('Stopping Volume (Bearish)');
            }
        }
        
        // Check for spring/upthrust pattern
        if (detectSpringPattern(recentData)) {
            analysis.accumulationScore += 0.2;
            analysis.detectedPatterns.push('Spring Pattern');
        }
        
        if (detectUpthrustPattern(recentData)) {
            analysis.distributionScore += 0.2;
            analysis.detectedPatterns.push('Upthrust Pattern');
        }
    }
    
    // 7. Statistical Anomalies
    if (options.useAnomaly) {
        // Check for price anomalies with volume confirmation
        const recentAnomalies = recentData.filter(d => d.isPriceAnomaly && d.relativeVolume > 1.5);
        
        if (recentAnomalies.length > 0) {
            // Count bullish vs bearish anomalies
            const bullishAnomalies = recentAnomalies.filter(d => d.close > d.open).length;
            const bearishAnomalies = recentAnomalies.filter(d => d.close < d.open).length;
            
            if (bullishAnomalies > bearishAnomalies) {
                analysis.accumulationScore += 0.15;
                analysis.detectedPatterns.push('Statistical Anomaly (Bullish)');
            } else if (bearishAnomalies > bullishAnomalies) {
                analysis.distributionScore += 0.15;
                analysis.detectedPatterns.push('Statistical Anomaly (Bearish)');
            }
        }
    }
    
    // 8. Check for circular trading patterns
    if (detectCircularTrading(recentData)) {
        analysis.manipulationScore += 0.35;
        analysis.detectedPatterns.push('Circular Trading Pattern');
    }
    
    // Normalize scores to be between 0 and 1
    analysis.accumulationScore = Math.min(1, analysis.accumulationScore);
    analysis.distributionScore = Math.min(1, analysis.distributionScore);
    analysis.manipulationScore = Math.min(1, analysis.manipulationScore);
    
    return analysis;
}

function detectWyckoffAccumulation(data) {
    if (data.length < 20) return false;
    
    // Simplified Wyckoff accumulation detection
    // 1. Look for downtrend
    // 2. Followed by high volume at lows
    // 3. Decreased volume during tests
    // 4. Higher lows forming
    
    // Check for downtrend in first half of the data
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const isDowntrend = firstHalf[0].close > firstHalf[firstHalf.length - 1].close;
    
    if (!isDowntrend) return false;
    
    // Check for high volume at lows
    const lowestPoint = data.reduce((min, d, i) => d.low < data[min].low ? i : min, 0);
    const highVolumeAtLow = data[lowestPoint].volume > data[lowestPoint].avgVolume * 1.5;
    
    if (!highVolumeAtLow) return false;
    
    // Check for higher lows in second half
    const secondHalf = data.slice(Math.floor(data.length / 2));
    let formsHigherLows = true;
    
    for (let i = 1; i < secondHalf.length; i++) {
        if (secondHalf[i].low < secondHalf[i - 1].low) {
            formsHigherLows = false;
            break;
        }
    }
    
    return formsHigherLows;
}

function detectWyckoffDistribution(data) {
    if (data.length < 20) return false;
    
    // Simplified Wyckoff distribution detection
    // 1. Look for uptrend
    // 2. Followed by high volume at highs
    // 3. Decreased volume during tests
    // 4. Lower highs forming
    
    // Check for uptrend in first half of the data
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const isUptrend = firstHalf[0].close < firstHalf[firstHalf.length - 1].close;
    
    if (!isUptrend) return false;
    
    // Check for high volume at highs
    const highestPoint = data.reduce((max, d, i) => d.high > data[max].high ? i : max, 0);
    const highVolumeAtHigh = data[highestPoint].volume > data[highestPoint].avgVolume * 1.5;
    
    if (!highVolumeAtHigh) return false;
    
    // Check for lower highs in second half
    const secondHalf = data.slice(Math.floor(data.length / 2));
    let formsLowerHighs = true;
    
    for (let i = 1; i < secondHalf.length; i++) {
        if (secondHalf[i].high > secondHalf[i - 1].high) {
            formsLowerHighs = false;
            break;
        }
    }
    
    return formsLowerHighs;
}

function detectSpringPattern(data) {
    if (data.length < 10) return false;
    
    // Spring pattern: Price drops below support briefly then reverses
    const recent = data.slice(-5);
    const previous = data.slice(-15, -5);
    
    // Find lowest point in previous data
    const lowestPoint = previous.reduce((min, d, i) => d.low < previous[min].low ? i : min, 0);
    const supportLevel = previous[lowestPoint].low;
    
    // Check if any recent candle broke below support and then closed above
    for (let i = 0; i < recent.length; i++) {
        if (recent[i].low < supportLevel && recent[i].close > supportLevel && recent[i].volume > recent[i].avgVolume) {
            return true;
        }
    }
    
    return false;
}

function detectUpthrustPattern(data) {
    if (data.length < 10) return false;
    
    // Upthrust pattern: Price rises above resistance briefly then reverses
    const recent = data.slice(-5);
    const previous = data.slice(-15, -5);
    
    // Find highest point in previous data
    const highestPoint = previous.reduce((max, d, i) => d.high > previous[max].high ? i : max, 0);
    const resistanceLevel = previous[highestPoint].high;
    
    // Check if any recent candle broke above resistance and then closed below
    for (let i = 0; i < recent.length; i++) {
        if (recent[i].high > resistanceLevel && recent[i].close < resistanceLevel && recent[i].volume > recent[i].avgVolume) {
            return true;
        }
    }
    
    return false;
}

function detectCircularTrading(data) {
    if (data.length < 20) return false;
    
    // Look for price oscillating in a tight range with elevated volume
    const recent = data.slice(-10);
    
    // Calculate price range
    const highestHigh = Math.max(...recent.map(d => d.high));
    const lowestLow = Math.min(...recent.map(d => d.low));
    const priceRange = (highestHigh - lowestLow) / lowestLow;
    
    // Calculate average volume
    const avgVolume = recent.reduce((sum, d) => sum + d.volume, 0) / recent.length;
    const prevAvgVolume = data.slice(-20, -10).reduce((sum, d) => sum + d.volume, 0) / 10;
    
    // If price is in tight range (< 3%) but volume is elevated (> 1.5x)
    // This can indicate circular trading
    return priceRange < 0.03 && avgVolume > prevAvgVolume * 1.5;
}

function displayInstitutionalActivity() {
    const table = document.getElementById('activityTable');
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (institutionalActivityData.length === 0) {
        // Show empty state
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="8" class="no-data-message">
                No stocks with significant institutional activity detected.
                Try adjusting your detection settings or threshold.
            </td>
        `;
        tbody.appendChild(tr);
        return;
    }
    
    institutionalActivityData.forEach(stock => {
        const tr = document.createElement('tr');
        
        // Get score classes
        const accScoreClass = getScoreClass(stock.accumulationScore);
        const distScoreClass = getScoreClass(stock.distributionScore);
        const manipScoreClass = getScoreClass(stock.manipulationScore);
        
        // Format scores as percentages
        const accScore = Math.round(stock.accumulationScore * 100);
        const distScore = Math.round(stock.distributionScore * 100);
        const manipScore = Math.round(stock.manipulationScore * 100);
        
        // Create pattern tags HTML
        const patternTags = stock.detectedPatterns.map(pattern => {
            let tagClass = 'pattern-manipulation';
            
            if (pattern.includes('Bullish') || pattern.includes('Accumulation') || pattern.includes('Spring')) {
                tagClass = 'pattern-accumulation';
            } else if (pattern.includes('Bearish') || pattern.includes('Distribution') || pattern.includes('Upthrust')) {
                tagClass = 'pattern-distribution';
            }
            
            return `<span class="pattern-tag ${tagClass}">${pattern}</span>`;
        }).join(' ');
        
        tr.innerHTML = `
            <td>${stock.symbol}</td>
            <td>${stock.currentPrice.toFixed(2)}</td>
            <td class="accumulation-column">
                <span class="score-indicator ${accScoreClass}">${accScore}%</span>
            </td>
            <td class="distribution-column">
                <span class="score-indicator ${distScoreClass}">${distScore}%</span>
            </td>
            <td>
                <span class="score-indicator ${manipScoreClass}">${manipScore}%</span>
            </td>
            <td>
                <div class="indicator-list">${patternTags}</div>
            </td>
            <td>
                <div class="volume-bar" style="--fill-percent: ${getVolumeTrendPercent(stock.volumeTrend)}%">
                    <span class="volume-bar-text">${stock.volumeTrend}</span>
                </div>
            </td>
            <td class="chart-cell">
                <div class="chart-container-small" id="chart-container-${stock.symbol}"></div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    // Initialize charts for each stock
    initializeCharts();
}

function getScoreClass(score) {
    if (score >= 0.8) return 'score-high';
    if (score >= 0.6) return 'score-medium';
    return 'score-low';
}

function getVolumeTrendPercent(trend) {
    switch (trend) {
        case 'Increasing': return 90;
        case 'Stable': return 50;
        case 'Decreasing': return 20;
        default: return 50;
    }
}

// Part 4: Chart rendering and UI functions

// Initialize charts for all stocks
function initializeCharts() {
    institutionalActivityData.forEach(stock => {
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
    
    // Get recent data
    const allData = stockHistoricalData[symbol];
    const data = allData.slice(-60); // Last 60 days
    
    // Downsample if needed
    const displayData = downsampleData(data, 100);
    
    // Get stock analysis
    const stockAnalysis = institutionalActivityData.find(s => s.symbol === symbol);
    
    // Set up dimensions
    const width = chartContainer.clientWidth || 100; // Ensure minimum width
    const height = chartContainer.clientHeight || 100;
    const margin = {top: 5, right: 5, bottom: 15, left: 40};
    
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
    const minY = d3.min(displayData, d => d.low) * 0.99;
    const maxY = d3.max(displayData, d => d.high) * 1.01;
    
    const y = d3.scaleLinear()
        .domain([minY, maxY])
        .range([height - margin.bottom, margin.top]);
    
    // Add price line
    const line = d3.line()
        .x((d, i) => x(i))
        .y(d => y(d.close))
        .curve(d3.curveMonotoneX);
    
    // Draw price line
    svg.append("path")
        .datum(displayData)
        .attr("fill", "none")
        .attr("stroke", "#2196F3")
        .attr("stroke-width", 1.5)
        .attr("d", line);
    
    // Draw volume bars
    const volumeHeight = height * 0.2;
    const maxVolume = d3.max(displayData, d => d.volume);
    
    displayData.forEach((d, i) => {
        const barHeight = (d.volume / maxVolume) * volumeHeight;
        
        // Determine color based on price change
        const barColor = d.close > d.open ? "#4CAF50" : "#F44336";
        
        svg.append("rect")
            .attr("x", x(i) - 1.5)
            .attr("y", height - margin.bottom - barHeight)
            .attr("width", 3)
            .attr("height", barHeight)
            .attr("fill", barColor)
            .attr("opacity", 0.6);
    });
    
    // Add highlighted regions if applicable
    if (stockAnalysis) {
        // Add Wyckoff regions or other pattern highlights
        const patterns = stockAnalysis.detectedPatterns;
        
        if (patterns.includes('Wyckoff Accumulation') || patterns.includes('Spring Pattern')) {
            // Highlight accumulation region in green
            const startX = x(Math.max(0, displayData.length - 20));
            const endX = x(displayData.length - 1);
            const rectWidth = Math.max(1, endX - startX); // Ensure positive width
            
            svg.append("rect")
                .attr("x", startX)
                .attr("y", margin.top)
                .attr("width", rectWidth)
                .attr("height", height - margin.top - margin.bottom)
                .attr("fill", "#4CAF50")
                .attr("opacity", 0.1);
        } else if (patterns.includes('Wyckoff Distribution') || patterns.includes('Upthrust Pattern')) {
            // Highlight distribution region in red
            const startX = x(Math.max(0, displayData.length - 20));
            const endX = x(displayData.length - 1);
            const rectWidth = Math.max(1, endX - startX); // Ensure positive width
            
            svg.append("rect")
                .attr("x", startX)
                .attr("y", margin.top)
                .attr("width", rectWidth)
                .attr("height", height - margin.top - margin.bottom)
                .attr("fill", "#F44336")
                .attr("opacity", 0.1);
        }
        
        // Highlight circular trading if detected
        if (patterns.includes('Circular Trading Pattern')) {
            const startX = x(Math.max(0, displayData.length - 10));
            const endX = x(displayData.length - 1);
            const rectWidth = Math.max(1, endX - startX); // Ensure positive width
            
            svg.append("rect")
                .attr("x", startX)
                .attr("y", margin.top)
                .attr("width", rectWidth)
                .attr("height", height - margin.top - margin.bottom)
                .attr("fill", "#FF9800")
                .attr("opacity", 0.1)
                .attr("stroke", "#FF9800")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3");
        }
    }
    
    // Add Y axis
    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(3).tickFormat(d => d.toFixed(0)));
    
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
    
    // Clear existing chart
    popupChartContainer.innerHTML = '';
    
    // Set popup title
    popupTitle.textContent = `${symbol} - Institutional Activity Analysis`;
    
    // Show popup
    popupContainer.style.display = 'flex';
    
    // Ensure close button works
    const closeButton = document.querySelector('.chart-popup-close');
    if (closeButton) {
        // Remove any existing event listeners to prevent duplicates
        closeButton.replaceWith(closeButton.cloneNode(true));
        
        // Add event listener to the new button
        document.querySelector('.chart-popup-close').addEventListener('click', () => {
            console.log('Closing chart popup');
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
    
    // Get stock analysis
    const stockAnalysis = institutionalActivityData.find(s => s.symbol === symbol);
    
    // Process data
    const allData = stockHistoricalData[symbol];
    const displayData = allData.slice(-120); // Last 120 days
    
    // Wait for the popup to be visible before rendering the chart
    setTimeout(() => {
        // Set up dimensions
        const width = popupChartContainer.clientWidth || 800;
        const height = popupChartContainer.clientHeight || 500;
        const margin = {top: 40, right: 80, bottom: 40, left: 60};
        
        // Create SVG
        const svg = d3.select(popupChartContainer)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [0, 0, width, height]);
        
        // X scale - use date
        const x = d3.scaleLinear()
            .domain([0, displayData.length - 1])
            .range([margin.left, width - margin.right]);
        
        // Y scale for price
        const minY = d3.min(displayData, d => d.low) * 0.99;
        const maxY = d3.max(displayData, d => d.high) * 1.01;
        
        const y = d3.scaleLinear()
            .domain([minY, maxY])
            .range([height - margin.bottom - 100, margin.top]); // Leave room for volume
        
        // Y scale for volume
        const maxVolume = d3.max(displayData, d => d.volume);
        const yVolume = d3.scaleLinear()
            .domain([0, maxVolume])
            .range([height - margin.bottom, height - margin.bottom - 100]);
        
        // Add X axis
        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(10).tickFormat((d) => {
                if (d < displayData.length && d >= 0) {
                    return d3.timeFormat('%b %d')(displayData[d].date);
                }
                return '';
            }));
        
        // Add Y axis
        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).tickFormat(d => d.toFixed(0)));
        
        // Add volume Y axis
        svg.append("g")
            .attr("transform", `translate(${width - margin.right},0)`)
            .call(d3.axisRight(yVolume).ticks(3).tickFormat(d => {
                if (d >= 1000000) {
                    return (d / 1000000).toFixed(1) + 'M';
                } else if (d >= 1000) {
                    return (d / 1000).toFixed(0) + 'K';
                }
                return d;
            }));
        
        // Draw candlesticks
        displayData.forEach((d, i) => {
            // Candlestick body
            const bodyColor = d.close > d.open ? "#26a69a" : "#ef5350";
            const bodyY = y(Math.max(d.open, d.close));
            const bodyHeight = Math.abs(y(d.open) - y(d.close));
            
            svg.append("rect")
                .attr("x", x(i) - 4)
                .attr("y", bodyY)
                .attr("width", 8)
                .attr("height", Math.max(1, bodyHeight)) // Ensure visible even if open=close
                .attr("fill", bodyColor);
            
            // Candlestick wicks
            svg.append("line")
                .attr("x1", x(i))
                .attr("x2", x(i))
                .attr("y1", y(d.high))
                .attr("y2", y(d.low))
                .attr("stroke", bodyColor)
                .attr("stroke-width", 1);
        });
        
        // Draw volume bars
        displayData.forEach((d, i) => {
            // Volume bar color matches candle color
            const barColor = d.close > d.open ? "#26a69a" : "#ef5350";
            
            svg.append("rect")
                .attr("x", x(i) - 4)
                .attr("y", yVolume(d.volume))
                .attr("width", 8)
                .attr("height", yVolume(0) - yVolume(d.volume))
                .attr("fill", barColor)
                .attr("opacity", 0.6);
        });
        
        // Draw OBV line
        const obvLine = d3.line()
            .x((d, i) => x(i))
            .y(d => {
                // Normalize OBV to fit in the volume area
                const minObv = d3.min(displayData, d => d.obv);
                const maxObv = d3.max(displayData, d => d.obv);
                const normalizedObv = (d.obv - minObv) / (maxObv - minObv);
                
                // Position OBV line at the bottom of the chart
                return height - margin.bottom - 50 - normalizedObv * 50;
            })
            .curve(d3.curveMonotoneX);
        
        svg.append("path")
            .datum(displayData)
            .attr("fill", "none")
            .attr("stroke", "#9c27b0")
            .attr("stroke-width", 1.5)
            .attr("d", obvLine);
        
        // Add OBV label
        svg.append("text")
            .attr("x", width - margin.right - 60)
            .attr("y", height - margin.bottom - 50)
            .attr("text-anchor", "end")
            .attr("font-size", "12px")
            .attr("fill", "#9c27b0")
            .text("OBV");
        
        // Add VWAP line
        if (displayData[0].vwap) {
            const vwapLine = d3.line()
                .x((d, i) => x(i))
                .y(d => y(d.vwap))
                .curve(d3.curveMonotoneX);
            
            svg.append("path")
                .datum(displayData)
                .attr("fill", "none")
                .attr("stroke", "#ff9800")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "5,5")
                .attr("d", vwapLine);
            
            // Add VWAP label
            svg.append("text")
                .attr("x", width - margin.right)
                .attr("y", y(displayData[displayData.length - 1].vwap))
                .attr("text-anchor", "start")
                .attr("font-size", "12px")
                .attr("fill", "#ff9800")
                .text("VWAP");
        }
        
        // Add annotations if there are patterns detected
        if (stockAnalysis && stockAnalysis.detectedPatterns.length > 0) {
            // Find starting points for annotations
            let annotationY = margin.top + 20;
            const annotationIncrement = 20;
            
            stockAnalysis.detectedPatterns.forEach((pattern, i) => {
                let patternColor = "#757575";
                
                if (pattern.includes('Bullish') || pattern.includes('Accumulation') || pattern.includes('Spring')) {
                    patternColor = "#4CAF50";
                } else if (pattern.includes('Bearish') || pattern.includes('Distribution') || pattern.includes('Upthrust')) {
                    patternColor = "#F44336";
                } else if (pattern.includes('Trading') || pattern.includes('Manipulation')) {
                    patternColor = "#FF9800";
                }
                
                svg.append("text")
                    .attr("x", margin.left + 10)
                    .attr("y", annotationY + i * annotationIncrement)
                    .attr("font-size", "12px")
                    .attr("fill", patternColor)
                    .text(pattern);
            });
            
            // Add institutional score indicators
            const scoreY = annotationY + stockAnalysis.detectedPatterns.length * annotationIncrement + 30;
            
            // Accumulation score
            svg.append("text")
                .attr("x", margin.left + 10)
                .attr("y", scoreY)
                .attr("font-size", "12px")
                .attr("fill", "#2E7D32")
                .text(`Accumulation: ${Math.round(stockAnalysis.accumulationScore * 100)}%`);
            
            // Distribution score
            svg.append("text")
                .attr("x", margin.left + 10)
                .attr("y", scoreY + 20)
                .attr("font-size", "12px")
                .attr("fill", "#C62828")
                .text(`Distribution: ${Math.round(stockAnalysis.distributionScore * 100)}%`);
                
            // Manipulation score
            svg.append("text")
                .attr("x", margin.left + 10)
                .attr("y", scoreY + 40)
                .attr("font-size", "12px")
                .attr("fill", "#FF8F00")
                .text(`Manipulation: ${Math.round(stockAnalysis.manipulationScore * 100)}%`);
        }
        
        // Add chart title
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", margin.top / 2)
            .attr("text-anchor", "middle")
            .attr("font-size", "16px")
            .attr("font-weight", "bold")
            .text(`${symbol} - Institutional Activity Analysis`);
    }, 100);
}

// Downsample data to prevent performance issues with large datasets
function downsampleData(data, threshold = 200) {
    if (!data || data.length <= threshold) return data;
    
    const factor = Math.ceil(data.length / threshold);
    return data.filter((_, i) => i % factor === 0);
}

function updatePatternAnalysis() {
    const patternChartContainer = document.getElementById('patternChartContainer');
    if (!patternChartContainer) return;
    
    // Clear any existing content
    patternChartContainer.innerHTML = '';
    
    // Get enabled pattern types
    const showAccumulation = document.getElementById('showAccumulation')?.checked || true;
    const showDistribution = document.getElementById('showDistribution')?.checked || true;
    const showManipulation = document.getElementById('showManipulation')?.checked || true;
    
    // Get timeframe
    const patternTimeframe = document.getElementById('patternTimeframe')?.value || 'weekly';
    
    // Perform fresh pattern analysis on all user stocks using historical data
    let analysisData = [];
    userStocks.forEach(stock => {
        const symbol = stock.symbol;
        const data = stockHistoricalData[symbol];
        const currentPrice = currentPrices[symbol] || 0;
        if (!data || data.length < MIN_DATA_POINTS || currentPrice <= 0) return;
        const analysis = analyzeInstitutionalActivity(symbol, data, currentPrice, {
            useVolume: false,
            useObv: false,
            useVolumeSpread: false,
            useVwap: false,
            useWyckoff: showAccumulation || showDistribution,
            usePriceAction: showManipulation,
            useAnomaly: false
        });
        analysisData.push({ symbol, ...analysis });
    });
    // Filter based on selected pattern types
    let filteredData = analysisData.filter(stock => {
        if (showAccumulation && stock.accumulationScore > 0) return true;
        if (showDistribution && stock.distributionScore > 0) return true;
        if (showManipulation && stock.manipulationScore > 0) return true;
        return false;
    });

    // If no data matches the criteria
    if (filteredData.length === 0) {
        const noDataLabel = document.createElement('div');
        noDataLabel.textContent = 'No patterns detected with current settings';
        noDataLabel.style.position = 'absolute';
        noDataLabel.style.top = '50%';
        noDataLabel.style.left = '50%';
        noDataLabel.style.transform = 'translate(-50%, -50%)';
        noDataLabel.style.color = '#999';
        noDataLabel.style.fontSize = '16px';
        patternChartContainer.appendChild(noDataLabel);
        return;
    }
    
    // Sort by pattern strength (highest score)
    filteredData.sort((a, b) => {
        const maxScoreA = Math.max(a.accumulationScore, a.distributionScore, a.manipulationScore);
        const maxScoreB = Math.max(b.accumulationScore, b.distributionScore, b.manipulationScore);
        return maxScoreB - maxScoreA;
    });
    
    // Create bar chart for pattern types
    const width = patternChartContainer.clientWidth;
    const height = patternChartContainer.clientHeight || 250;
    const margin = {top: 40, right: 80, bottom: 60, left: 80};
    
    // Create SVG
    const svg = d3.select(patternChartContainer)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);
    
    // Limit to top 10 stocks
    const topStocks = filteredData.slice(0, 10);
    
    // X scale
    const x = d3.scaleBand()
        .domain(topStocks.map(d => d.symbol))
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
        .text("Pattern Confidence (%)");
    
    // Add bars for each stock
    const barWidth = x.bandwidth() / 3;
    
    // Accumulation bars
    if (showAccumulation) {
        svg.selectAll("rect.accumulation")
            .data(topStocks)
            .join("rect")
            .attr("class", "accumulation")
            .attr("x", d => x(d.symbol))
            .attr("y", d => y(d.accumulationScore))
            .attr("width", barWidth)
            .attr("height", d => height - margin.bottom - y(d.accumulationScore))
            .attr("fill", "#4CAF50");
    }
    
    // Distribution bars
    if (showDistribution) {
        svg.selectAll("rect.distribution")
            .data(topStocks)
            .join("rect")
            .attr("class", "distribution")
            .attr("x", d => x(d.symbol) + barWidth)
            .attr("y", d => y(d.distributionScore))
            .attr("width", barWidth)
            .attr("height", d => height - margin.bottom - y(d.distributionScore))
            .attr("fill", "#F44336");
    }
    
    // Manipulation bars
    if (showManipulation) {
        svg.selectAll("rect.manipulation")
            .data(topStocks)
            .join("rect")
            .attr("class", "manipulation")
            .attr("x", d => x(d.symbol) + barWidth * 2)
            .attr("y", d => y(d.manipulationScore))
            .attr("width", barWidth)
            .attr("height", d => height - margin.bottom - y(d.manipulationScore))
            .attr("fill", "#FF9800");
    }
    
    // Add legend
    const legendX = width - margin.right + 10;
    const legendY = margin.top;
    
    if (showAccumulation) {
        svg.append("rect")
            .attr("x", legendX)
            .attr("y", legendY)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", "#4CAF50");
        
        svg.append("text")
            .attr("x", legendX + 20)
            .attr("y", legendY + 12)
            .attr("font-size", "12px")
            .text("Accumulation");
    }
    
    if (showDistribution) {
        svg.append("rect")
            .attr("x", legendX)
            .attr("y", legendY + 25)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", "#F44336");
        
        svg.append("text")
            .attr("x", legendX + 20)
            .attr("y", legendY + 37)
            .attr("font-size", "12px")
            .text("Distribution");
    }
    
    if (showManipulation) {
        svg.append("rect")
            .attr("x", legendX)
            .attr("y", legendY + 50)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", "#FF9800");
        
        svg.append("text")
            .attr("x", legendX + 20)
            .attr("y", legendY + 62)
            .attr("font-size", "12px")
            .text("Manipulation");
    }
    
    // Chart title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(`Institutional Activity Patterns (${patternTimeframe.charAt(0).toUpperCase() + patternTimeframe.slice(1)})`);
}

// Part 5: Volume analysis and utility functions

function updateVolumeAnalysis() {
    const volumeChartContainer = document.getElementById('volumeChartContainer');
    if (!volumeChartContainer) return;
    
    // Clear any existing content
    volumeChartContainer.innerHTML = '';
    
    // Only show stocks in user's dashboard
    const userSymbols = userStocks.map(s => s.symbol);
    
    // Get filter settings
    const showRelativeVolume = document.getElementById('showRelativeVolume')?.checked || true;
    const showVolumeProfile = document.getElementById('showVolumeProfile')?.checked || true;
    const showVolumeAnomaly = document.getElementById('showVolumeAnomaly')?.checked || true;
    
    // Get volume threshold
    const volumeThreshold = parseFloat(document.getElementById('volumeThreshold')?.value || '2');
    
    // Find stocks with volume anomalies
    let volumeAnomalyStocks = [];
    
    // Process only userStocks symbols
    userSymbols.forEach(symbol => {
        const data = stockHistoricalData[symbol];
        if (!data || data.length < 30) return;
        
        // Get the most recent data
        const recentData = data.slice(-20);
        
        // Calculate average volume
        const avgVolume = recentData.reduce((sum, d) => sum + d.volume, 0) / recentData.length;
        
        // Find recent volume spikes
        const volumeSpikes = recentData.filter(d => d.volume > avgVolume * volumeThreshold);
        
        if (volumeSpikes.length > 0) {
            // Calculate volume profile metrics
            const volumeProfile = analyzeVolumeProfile(recentData);
            
            volumeAnomalyStocks.push({
                symbol: symbol,
                avgVolume: avgVolume,
                maxRelativeVolume: Math.max(...recentData.map(d => d.volume / avgVolume)),
                volumeSpikes: volumeSpikes.length,
                lastPrice: recentData[recentData.length - 1].close,
                volumeProfile: volumeProfile
            });
        }
    });
    
    // Sort by number of volume spikes
    volumeAnomalyStocks.sort((a, b) => b.volumeSpikes - a.volumeSpikes);
    
    // Limit to top 15 stocks
    const topVolumeStocks = volumeAnomalyStocks.slice(0, 15);
    
    // If no volume anomalies found
    if (topVolumeStocks.length === 0) {
        const noDataLabel = document.createElement('div');
        noDataLabel.textContent = 'No volume anomalies detected with current settings';
        noDataLabel.style.position = 'absolute';
        noDataLabel.style.top = '50%';
        noDataLabel.style.left = '50%';
        noDataLabel.style.transform = 'translate(-50%, -50%)';
        noDataLabel.style.color = '#999';
        noDataLabel.style.fontSize = '16px';
        volumeChartContainer.appendChild(noDataLabel);
        return;
    }
    
    // Create visualization
    if (showRelativeVolume) {
        createRelativeVolumeChart(volumeChartContainer, topVolumeStocks);
    } else if (showVolumeProfile) {
        createVolumeProfileChart(volumeChartContainer, topVolumeStocks);
    } else if (showVolumeAnomaly) {
        createVolumeAnomalyChart(volumeChartContainer, topVolumeStocks);
    } else {
        // Default to relative volume chart
        createRelativeVolumeChart(volumeChartContainer, topVolumeStocks);
    }
}

function analyzeVolumeProfile(data) {
    // Calculate volume at price levels
    const priceVolume = {};
    
    // Group by rounded price levels
    data.forEach(d => {
        const priceLevel = Math.round(d.close);
        if (!priceVolume[priceLevel]) {
            priceVolume[priceLevel] = 0;
        }
        priceVolume[priceLevel] += d.volume;
    });
    
    // Find highest volume price level
    let maxVolumePrice = 0;
    let maxVolume = 0;
    
    Object.keys(priceVolume).forEach(price => {
        if (priceVolume[price] > maxVolume) {
            maxVolume = priceVolume[price];
            maxVolumePrice = parseInt(price);
        }
    });
    
    // Calculate volume weighted average price
    let totalVolume = 0;
    let weightedSum = 0;
    
    data.forEach(d => {
        totalVolume += d.volume;
        weightedSum += d.close * d.volume;
    });
    
    const vwap = weightedSum / totalVolume;
    
    return {
        maxVolumePrice: maxVolumePrice,
        vwap: vwap,
        priceVolume: priceVolume
    };
}

function createRelativeVolumeChart(container, stocks) {
    // Create bar chart for relative volume
    const width = container.clientWidth;
    const height = container.clientHeight || 250;
    const margin = {top: 40, right: 60, bottom: 60, left: 80};
    
    // Create SVG
    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);
    
    // X scale
    const x = d3.scaleBand()
        .domain(stocks.map(d => d.symbol))
        .range([margin.left, width - margin.right])
        .padding(0.3);
    
    // Y scale
    const y = d3.scaleLinear()
        .domain([0, d3.max(stocks, d => d.maxRelativeVolume) * 1.1])
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
        .call(d3.axisLeft(y).tickFormat(d => {
            // Use more descriptive labels instead of technical "2x" format
            if (d === 0) return "Normal";
            if (d <= 1) return "Low";
            if (d <= 2) return "Above Avg";
            if (d <= 3) return "High";
            return "Very High";
        }));
    
    // Add Y axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", margin.left / 3)
        .attr("x", -(height / 2))
        .attr("text-anchor", "middle")
        .text("Volume Strength");
    
    // Add bars
    svg.selectAll("rect.volume-bar")
        .data(stocks)
        .join("rect")
        .attr("class", "volume-bar")
        .attr("x", d => x(d.symbol))
        .attr("y", d => y(d.maxRelativeVolume))
        .attr("width", x.bandwidth())
        .attr("height", d => height - margin.bottom - y(d.maxRelativeVolume))
        .attr("fill", d => {
            // Color based on volume intensity
            if (d.maxRelativeVolume >= 3) return "#D32F2F"; // Very high volume
            if (d.maxRelativeVolume >= 2) return "#F57C00"; // High volume
            return "#7CB342"; // Moderate volume
        });
    
    // Add labels on top of bars
    svg.selectAll(".volume-label")
        .data(stocks)
        .join("text")
        .attr("class", "volume-label")
        .attr("x", d => x(d.symbol) + x.bandwidth() / 2)
        .attr("y", d => y(d.maxRelativeVolume) - 5)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .text(d => {
            // Convert technical volume ratio to user-friendly descriptive terms
            if (d.maxRelativeVolume >= 3) return "Very High";
            if (d.maxRelativeVolume >= 2) return "High";
            if (d.maxRelativeVolume >= 1.5) return "Above Avg";
            return "Normal";
        });
    
    // Chart title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text("Stocks with Unusual Volume Activity");
}

function createVolumeProfileChart(container, stocks) {
    // Create scatter plot for volume profile
    const width = container.clientWidth;
    const height = container.clientHeight || 250;
    const margin = {top: 40, right: 60, bottom: 60, left: 80};
    
    // Create SVG
    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);
    
    // X scale for symbols
    const x = d3.scaleBand()
        .domain(stocks.map(d => d.symbol))
        .range([margin.left, width - margin.right])
        .padding(0.3);
    
    // Y scale for price deviation (from VWAP)
    const y = d3.scaleLinear()
        .domain([-15, 15])
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
        .call(d3.axisLeft(y).tickFormat(d => d + '%'));
    
    // Add Y axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", margin.left / 3)
        .attr("x", -(height / 2))
        .attr("text-anchor", "middle")
        .text("Current Price Deviation from VWAP (%)");
    
    // Draw zero line
    svg.append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", y(0))
        .attr("y2", y(0))
        .attr("stroke", "#757575")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");
    
    // Draw circles for each stock
    svg.selectAll("circle")
        .data(stocks)
        .join("circle")
        .attr("cx", d => x(d.symbol) + x.bandwidth() / 2)
        .attr("cy", d => {
            // Calculate percent deviation from VWAP
            const percentDev = ((d.lastPrice - d.volumeProfile.vwap) / d.volumeProfile.vwap) * 100;
            return y(percentDev);
        })
        .attr("r", d => 5 + Math.sqrt(d.volumeSpikes) * 2) // Size based on number of spikes
        .attr("fill", d => {
            // Color based on price relative to VWAP
            const percentDev = ((d.lastPrice - d.volumeProfile.vwap) / d.volumeProfile.vwap) * 100;
            if (percentDev > 0) return "#4CAF50"; // Above VWAP
            return "#F44336"; // Below VWAP
        })
        .attr("opacity", 0.7);
    
    // Add labels
    svg.selectAll(".volume-label")
        .data(stocks)
        .join("text")
        .attr("class", "volume-label")
        .attr("x", d => x(d.symbol) + x.bandwidth() / 2)
        .attr("y", d => {
            const percentDev = ((d.lastPrice - d.volumeProfile.vwap) / d.volumeProfile.vwap) * 100;
            return y(percentDev) - 10;
        })
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .text(d => {
            const percentDev = ((d.lastPrice - d.volumeProfile.vwap) / d.volumeProfile.vwap) * 100;
            return percentDev.toFixed(1) + '%';
        });
    
    // Chart title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text("Volume Profile Analysis - Price vs VWAP");
}

function createVolumeAnomalyChart(container, stocks) {
    // Create heat map for volume anomalies
    const width = container.clientWidth;
    const height = container.clientHeight || 250;
    const margin = {top: 40, right: 60, bottom: 60, left: 80};
    
    // Create SVG
    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);
    
    // X scale for symbols
    const x = d3.scaleBand()
        .domain(stocks.map(d => d.symbol))
        .range([margin.left, width - margin.right])
        .padding(0.1);
    
    // Y scale for number of spikes
    const y = d3.scaleLinear()
        .domain([0, d3.max(stocks, d => d.volumeSpikes) + 1])
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
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => Math.floor(d)));
    
    // Add Y axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", margin.left / 3)
        .attr("x", -(height / 2))
        .attr("text-anchor", "middle")
        .text("Number of Volume Spikes");
    
    // Create colored rectangles for each stock
    svg.selectAll("rect")
        .data(stocks)
        .join("rect")
        .attr("x", d => x(d.symbol))
        .attr("y", d => y(d.volumeSpikes))
        .attr("width", x.bandwidth())
        .attr("height", d => height - margin.bottom - y(d.volumeSpikes))
        .attr("fill", d => {
            // Color based on volume intensity
            if (d.volumeSpikes >= 6) return "#D32F2F";
            if (d.volumeSpikes >= 4) return "#F57C00";
            if (d.volumeSpikes >= 2) return "#FFC107";
            return "#7CB342";
        });
    
    // Add labels
    svg.selectAll(".anomaly-label")
        .data(stocks)
        .join("text")
        .attr("class", "anomaly-label")
        .attr("x", d => x(d.symbol) + x.bandwidth() / 2)
        .attr("y", d => y(d.volumeSpikes) + 15)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("fill", "white")
        .text(d => d.volumeSpikes);
    
    // Chart title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text("Volume Anomaly Distribution");
}

// Manual stock entry form
function showManualStockForm() {
    const manualStockForm = document.getElementById('manualStockForm');
    if (manualStockForm) {
        manualStockForm.style.display = 'block';
        document.getElementById('manualSymbol')?.focus();
        console.log('Manual stock form displayed');
    } else {
        console.error('Manual stock form element not found');
    }
}

function hideManualStockForm() {
    const manualStockForm = document.getElementById('manualStockForm');
    if (manualStockForm) {
        manualStockForm.style.display = 'none';
    }
}

function saveManualStock() {
    const symbolInput = document.getElementById('manualSymbol');
    if (!symbolInput) return;
    
    const symbol = symbolInput.value.trim().toUpperCase();
    
    if (!symbol) {
        showError('Please enter a stock symbol');
        return;
    }
    
    // Check if the symbol already exists in userStocks
    const exists = userStocks.some(stock => stock.symbol === symbol);
    
    if (!exists) {
        // Add to userStocks
        userStocks.push({ symbol });
        
        // Save to localStorage
        localStorage.setItem('userStocks', JSON.stringify(userStocks));
        
        showSuccess(`Added ${symbol} to your stocks`);
        
        // Refresh data
        loadCurrentPrices();
        detectInstitutionalActivity();
    } else {
        showError(`${symbol} is already in your list`);
    }
    
    // Clear input and hide form
    symbolInput.value = '';
    hideManualStockForm();
}

// Message display functions
function showError(message) {
    const container = document.getElementById('messageContainer');
    if (!container) return;
    
    container.innerHTML = `<div class="error-message">${message}<button class="close-btn">&times;</button></div>`;
    
    document.querySelector('.close-btn').addEventListener('click', function() {
        container.innerHTML = '';
    });
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        if (container.querySelector('.error-message')) {
            container.innerHTML = '';
        }
    }, 5000);
}

function showSuccess(message) {
    const container = document.getElementById('messageContainer');
    if (!container) return;
    
    container.innerHTML = `<div class="success-message">${message}<button class="close-btn">&times;</button></div>`;
    
    document.querySelector('.close-btn').addEventListener('click', function() {
        container.innerHTML = '';
    });
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        if (container.querySelector('.success-message')) {
            container.innerHTML = '';
        }
    }, 3000);
}

function showLoading(show, message = 'Loading...') {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const statusMessage = document.getElementById('loadingStatusMessage');
    
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'flex' : 'none';
        
        if (statusMessage) {
            statusMessage.textContent = message;
        }
    }
} 
