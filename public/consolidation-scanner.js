// Global variables
let availableStocks = [];
let userStocks = [];
let currentPrices = {};
let consolidationStocks = [];
let stockHistoricalData = {}; // To store historical data
let chartInstances = {}; // To store chart instances by symbol
let consolidationStocksHistory = JSON.parse(localStorage.getItem('consolidationStocksHistory') || '{}'); // Track filtered stocks
let boughtStocks = JSON.parse(localStorage.getItem('boughtStocks') || '[]'); // Track bought stocks
let autoRefreshInterval = null;
const NEW_BADGE_DAYS = 3; // Show "New" badge for stocks added in the last 3 days
const DEFAULT_LOOKBACK_PERIOD = 20; // Default lookback period
const DEFAULT_MIN_PERCENTAGE = 0; // Default minimum range percentage
const DEFAULT_MAX_PERCENTAGE = 5; // Default maximum range percentage

document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    setupEventListeners();
    
    // Create chart popup element if not exists
    if (!document.querySelector('.chart-popup')) {
        createChartPopup();
    }
    
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
    filterConsolidationStocks();
}

function setupEventListeners() {
    document.getElementById('refreshListBtn').addEventListener('click', () => {
        loadCurrentPrices();
        filterConsolidationStocks();
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
        filterConsolidationStocks();
    });
    
    document.getElementById('minPercentage').addEventListener('change', () => {
        saveFilterSettings();
        filterConsolidationStocks();
    });
    
    document.getElementById('maxPercentage').addEventListener('change', () => {
        saveFilterSettings();
        filterConsolidationStocks();
    });
    
    document.getElementById('checkVolume').addEventListener('change', () => {
        saveFilterSettings();
        filterConsolidationStocks();
    });
    
    document.getElementById('showBoughtStocks').addEventListener('change', () => {
        saveFilterSettings();
        filterConsolidationStocks();
    });
    
    // Handle window resize for responsive charts
    window.addEventListener('resize', () => {
        // Redraw all charts on resize
        Object.keys(chartInstances).forEach(symbol => {
            if (chartInstances[symbol] && chartInstances[symbol].container) {
                // Remove existing chart
                const container = chartInstances[symbol].container;
                if (container) {
                    // Recreate the chart
                    initializeStockChart(symbol);
                }
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
            filterConsolidationStocks();
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
            filterConsolidationStocks();
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
        
        filterConsolidationStocks();
    } catch (error) {
        console.error('Error fetching prices:', error);
        showError('Failed to fetch current prices');
        showLoading(false);
    }
}

function filterConsolidationStocks() {
    if (!stockHistoricalData || Object.keys(stockHistoricalData).length === 0) {
        // This message is no longer needed since the charts are showing properly
        showLoading(false);
        return;
    }
    
    // Get filter settings
    const lookbackPeriod = parseInt(document.getElementById('lookbackPeriod').value) || DEFAULT_LOOKBACK_PERIOD;
    const minPercentage = parseFloat(document.getElementById('minPercentage').value) || DEFAULT_MIN_PERCENTAGE;
    const maxPercentage = parseFloat(document.getElementById('maxPercentage').value) || DEFAULT_MAX_PERCENTAGE;
    const checkVolume = document.getElementById('checkVolume').checked;
    const showBoughtStocks = document.getElementById('showBoughtStocks').checked;
    
    consolidationStocks = [];
    
    // Process each stock with historical data
    Object.keys(stockHistoricalData).forEach(symbol => {
        // Only process stocks that are in dashboard (userStocks)
        if (!userStocks.some(stock => stock.symbol === symbol)) return;
        
        // Skip if no current price
        if (!currentPrices[symbol]) return;
        
        // Check if it's a bought stock and filter accordingly
        const isBought = isBoughtStock(symbol);
        if (isBought && !showBoughtStocks) return;
        
        const historicalData = stockHistoricalData[symbol];
        if (!historicalData || historicalData.length < lookbackPeriod) return;
        
        // Get current price and price from lookback period ago
        const currentPrice = currentPrices[symbol];
        const recentData = historicalData.slice(-lookbackPeriod);
        const startPrice = recentData[0].close;
        
        // Calculate range as percentage
        const priceRange = Math.abs(((currentPrice - startPrice) / startPrice) * 100);
        
        // Check if within consolidation range
        if (priceRange >= minPercentage && priceRange <= maxPercentage) {
            // Check volume trend if required
            let volumeTrend = 0;
            if (checkVolume) {
                volumeTrend = calculateVolumeTrend(recentData);
                // Only include stocks with decreasing volume (negative trend) if checkbox is checked
                if (checkVolume && volumeTrend >= 0) return;
            }
            
            // Add to filtered list
            consolidationStocks.push({
                symbol,
                currentPrice,
                startPrice,
                priceRange,
                volumeTrend,
                isBought,
                isNew: isNewFiltered(symbol)
            });
        }
    });
    
    // Sort by range (ascending)
    consolidationStocks.sort((a, b) => a.priceRange - b.priceRange);
    
    // Display filtered stocks
    displayConsolidationStocks();
    showLoading(false);
}

function calculateVolumeTrend(data) {
    // Simple linear regression on volume data
    const x = Array.from({ length: data.length }, (_, i) => i);
    const y = data.map(d => d.volume);
    
    // Calculate means
    const meanX = x.reduce((sum, val) => sum + val, 0) / x.length;
    const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;
    
    // Calculate slope
    const numerator = x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0);
    const denominator = x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0);
    
    // Return slope (positive = increasing, negative = decreasing)
    return denominator !== 0 ? numerator / denominator : 0;
}

function isNewFiltered(symbol) {
    const key = `consolidation_${symbol}`;
    if (!consolidationStocksHistory[key]) {
        // First time seeing this stock, add to history
        consolidationStocksHistory[key] = new Date().toISOString();
        localStorage.setItem('consolidationStocksHistory', JSON.stringify(consolidationStocksHistory));
        return true;
    }
    
    // Check if it was added within last NEW_BADGE_DAYS days
    const firstSeen = new Date(consolidationStocksHistory[key]);
    const now = new Date();
    const diffDays = Math.floor((now - firstSeen) / (1000 * 60 * 60 * 24));
    
    return diffDays < NEW_BADGE_DAYS;
}

function isBoughtStock(symbol) {
    return boughtStocks.some(stock => stock.symbol === symbol);
}

function displayConsolidationStocks() {
    const tableBody = document.querySelector('#consolidationTable tbody');
    tableBody.innerHTML = '';
    
    if (consolidationStocks.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="8" style="text-align: center;">No stocks found matching criteria</td>`;
        tableBody.appendChild(row);
        return;
    }
    
    // Create rows for each filtered stock
    consolidationStocks.forEach((stock, index) => {
        const row = document.createElement('tr');
        
        // Determine range class based on percentage
        let rangeClass = '';
        if (stock.priceRange < 2) {
            rangeClass = 'tight-consolidation';
        } else if (stock.priceRange < 3.5) {
            rangeClass = 'moderate-consolidation';
        } else {
            rangeClass = 'wide-consolidation';
        }
        
        // Format volume trend
        let volumeTrendText = 'N/A';
        let volumeTrendClass = '';
        if (stock.volumeTrend < 0) {
            volumeTrendText = 'Decreasing';
            volumeTrendClass = 'positive-trend';
        } else if (stock.volumeTrend > 0) {
            volumeTrendText = 'Increasing';
            volumeTrendClass = 'negative-trend';
        } else {
            volumeTrendText = 'Neutral';
        }
        
        // Create badges for new and bought stocks
        const badgesHtml = createBadgesHtml(stock);
        
        // Build row HTML
        row.innerHTML = `
            <td><input type="checkbox" class="stock-checkbox" data-symbol="${stock.symbol}"></td>
            <td>${stock.symbol} ${badgesHtml}</td>
            <td>${stock.currentPrice.toFixed(2)}</td>
            <td>${stock.startPrice.toFixed(2)}</td>
            <td class="${rangeClass}">${stock.priceRange.toFixed(2)}%</td>
            <td class="${volumeTrendClass}">${volumeTrendText}</td>
            <td>
                <button class="watchlist-btn" data-index="${index}" data-symbol="${stock.symbol}">
                    ${isInWatchlist(stock.symbol) ? 'Remove from Watchlist' : 'Add to Watchlist'}
                </button>
                <button class="chart-btn" data-symbol="${stock.symbol}">
                    Chart
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
            const symbol = this.getAttribute('data-symbol');
            toggleWatchlist(symbol);
        });
    });
    
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const symbol = this.getAttribute('data-symbol');
            showFullScreenChart(symbol);
        });
    });
}

function createBadgesHtml(stock) {
    let badges = '';
    
    if (stock.isNew) {
        badges += `<span class="badge new-badge">New</span>`;
    }
    
    if (stock.isBought) {
        badges += `<span class="badge bought-badge">Bought</span>`;
    }
    
    return badges;
}

function isInWatchlist(symbol) {
    const foundStock = userStocks.find(s => s.symbol === symbol);
    return foundStock && foundStock.watchlist;
}

function toggleWatchlist(symbol) {
    // Check if stock already exists in userStocks
    const existingStockIndex = userStocks.findIndex(s => s.symbol === symbol);
    
    if (existingStockIndex >= 0) {
        // Toggle watchlist status
        userStocks[existingStockIndex].watchlist = !userStocks[existingStockIndex].watchlist;
    } else {
        // Add new stock to userStocks with watchlist=true
        userStocks.push({
            symbol,
            supportPrice1: 0,
            supportPrice2: 0,
            supportPrice3: 0,
            upperLimit: 0,
            folder: 'all',
            watchlist: true
        });
    }
    
    // Save updated userStocks
    localStorage.setItem('userStocks', JSON.stringify(userStocks));
    
    // Refresh display
    displayConsolidationStocks();
    showSuccess(`${symbol} ${isInWatchlist(symbol) ? 'added to' : 'removed from'} watchlist`);
}

function addSelectedToWatchlist() {
    const checkboxes = document.querySelectorAll('.stock-checkbox:checked');
    
    if (checkboxes.length === 0) {
        showError('No stocks selected');
        return;
    }
    
    let addedCount = 0;
    
    checkboxes.forEach(checkbox => {
        const symbol = checkbox.getAttribute('data-symbol');
        
        // Check if already in watchlist
        if (isInWatchlist(symbol)) {
            return;
        }
        
        // Check if already exists in userStocks
        const existingStockIndex = userStocks.findIndex(s => s.symbol === symbol);
        
        if (existingStockIndex >= 0) {
            // Update existing stock
            userStocks[existingStockIndex].watchlist = true;
        } else {
            // Add new stock
            userStocks.push({
                symbol,
                supportPrice1: 0,
                supportPrice2: 0,
                supportPrice3: 0,
                upperLimit: 0,
                folder: 'all',
                watchlist: true
            });
        }
        
        addedCount++;
    });
    
    // Save updated userStocks
    localStorage.setItem('userStocks', JSON.stringify(userStocks));
    
    // Refresh display
    displayConsolidationStocks();
    
    if (addedCount > 0) {
        showSuccess(`Added ${addedCount} stock${addedCount > 1 ? 's' : ''} to watchlist`);
    } else {
        showInfo('No new stocks added to watchlist');
    }
}

function downsampleData(data, threshold = 500) {
    if (data.length <= threshold) return data;
    
    const everyNth = Math.floor(data.length / threshold);
    return data.filter((_, i) => i % everyNth === 0);
}

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
    
    // Get start price and current price for this symbol
    const stockData = consolidationStocks.find(s => s.symbol === symbol);
    const startPrice = stockData ? stockData.startPrice : null;
    const currentPrice = stockData ? stockData.currentPrice : null;
    
    // Set up dimensions
    const width = chartContainer.clientWidth;
    const height = 80;
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
    
    // Y scale - ensure prices are included in the domain
    let minY = Math.min(
        d3.min(displayData, d => d.low) * 0.99,
        startPrice ? startPrice * 0.99 : Infinity
    );
    
    let maxY = Math.max(
        d3.max(displayData, d => d.high) * 1.01,
        startPrice ? startPrice * 1.01 : -Infinity
    );
    
    // Also include current price in the domain if available
    if (currentPrice && !isNaN(currentPrice)) {
        minY = Math.min(minY, currentPrice * 0.99);
        maxY = Math.max(maxY, currentPrice * 1.01);
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
    
    // Add start price line
    if (startPrice && !isNaN(startPrice)) {
        svg.append("line")
            .attr("x1", margin.left)
            .attr("x2", width - margin.right)
            .attr("y1", y(startPrice))
            .attr("y2", y(startPrice))
            .attr("stroke", "#FF9800")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");
    }
    
    // Add current price line
    if (currentPrice && !isNaN(currentPrice)) {
        svg.append("line")
            .attr("x1", margin.left)
            .attr("x2", width - margin.right)
            .attr("y1", y(currentPrice))
            .attr("y2", y(currentPrice))
            .attr("stroke", "#4CAF50")
            .attr("stroke-width", 1)
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
    
    // Get stock data, start price, and current price
    const stockData = consolidationStocks.find(s => s.symbol === symbol);
    const startPrice = stockData ? stockData.startPrice : null;
    const currentPrice = stockData ? stockData.currentPrice : null;
    const lookbackPeriod = parseInt(document.getElementById('lookbackPeriod').value) || DEFAULT_LOOKBACK_PERIOD;
    
    // Process data - use more data points for full screen
    const data = stockHistoricalData[symbol];
    
    // Downsample for large datasets but keep more points for detailed view
    const displayData = downsampleData(data, 1000);
    
    // Wait for the popup to be visible
    setTimeout(() => {
        // Set up dimensions
        const width = popupChartContainer.clientWidth || 800;
        const height = popupChartContainer.clientHeight || 400;
        const margin = {top: 20, right: 80, bottom: 30, left: 50};
        
        // Create SVG
        const svg = d3.select(popupChartContainer)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [0, 0, width, height]);
        
        // X scale - use index for simplicity
        const x = d3.scaleLinear()
            .domain([0, displayData.length - 1])
            .range([margin.left, width - margin.right]);
        
        // Y scale - ensure prices are included in the domain
        let minY = Math.min(
            d3.min(displayData, d => d.low) * 0.99,
            startPrice ? startPrice * 0.99 : Infinity
        );
        
        let maxY = Math.max(
            d3.max(displayData, d => d.high) * 1.01,
            startPrice ? startPrice * 1.01 : -Infinity
        );
        
        // Also include current price in the domain if available
        if (currentPrice && !isNaN(currentPrice)) {
            minY = Math.min(minY, currentPrice * 0.99);
            maxY = Math.max(maxY, currentPrice * 1.01);
        }
        
        const y = d3.scaleLinear()
            .domain([minY, maxY])
            .range([height - margin.bottom, margin.top]);
        
        // Add x-axis
        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(5).tickFormat(i => {
                const index = Math.floor(i);
                if (index >= 0 && index < displayData.length) {
                    return index; // Or format as needed
                }
                return "";
            }));
        
        // Add y-axis
        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y));
        
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
        
        // Add candlestick (optional for detailed view)
        svg.selectAll("rect.candle")
            .data(displayData)
            .enter()
            .append("rect")
            .attr("class", "candle")
            .attr("x", (d, i) => x(i) - 2)
            .attr("y", d => y(Math.max(d.open, d.close)))
            .attr("width", 4)
            .attr("height", d => Math.abs(y(d.open) - y(d.close)))
            .attr("fill", d => d.open > d.close ? "#f44336" : "#4caf50");
        
        // Add start price line
        if (startPrice && !isNaN(startPrice)) {
            svg.append("line")
                .attr("x1", margin.left)
                .attr("x2", width - margin.right)
                .attr("y1", y(startPrice))
                .attr("y2", y(startPrice))
                .attr("stroke", "#FF9800")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "5,5");
            
            // Add start price label
            svg.append("text")
                .attr("x", width - margin.right + 5)
                .attr("y", y(startPrice) + 4)
                .attr("fill", "#FF9800")
                .attr("font-size", "12px")
                .attr("text-anchor", "start")
                .text(`Start: ${startPrice.toFixed(2)}`);
        }
        
        // Add current price line
        if (currentPrice && !isNaN(currentPrice)) {
            svg.append("line")
                .attr("x1", margin.left)
                .attr("x2", width - margin.right)
                .attr("y1", y(currentPrice))
                .attr("y2", y(currentPrice))
                .attr("stroke", "#4CAF50")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "5,5");
            
            // Add current price label
            svg.append("text")
                .attr("x", width - margin.right + 5)
                .attr("y", y(currentPrice) + 4)
                .attr("fill", "#4CAF50")
                .attr("font-size", "12px")
                .attr("text-anchor", "start")
                .text(`Current: ${currentPrice.toFixed(2)}`);
        }
        
        // Add range percentage info
        const priceRange = stockData ? stockData.priceRange : null;
        if (priceRange && !isNaN(priceRange)) {
            svg.append("text")
                .attr("x", width - margin.right + 5)
                .attr("y", margin.top + 20)
                .attr("fill", priceRange <= 2 ? "#4caf50" : priceRange <= 5 ? "#2196f3" : "#ff9800")
                .attr("font-size", "12px")
                .attr("font-weight", "bold")
                .attr("text-anchor", "start")
                .text(`Range: ${priceRange.toFixed(2)}%`);
        }
        
        // Add title showing consolidation information
        svg.append("text")
            .attr("x", (width / 2))
            .attr("y", margin.top / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .text(`${symbol} - ${lookbackPeriod} Day Consolidation`);
        
        // Store reference to destroy on close
        popupContainer.chart = svg.node();
    }, 100);
}

async function fetchHistoricalData() {
    try {
        showLoading(true);
        const response = await fetch('/organized_nepse_data.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Process the data
        processHistoricalData(data);
        
        // After processing, filter stocks again
        filterConsolidationStocks();
        
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
            date: item.date || new Date().toISOString(),
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close),
            volume: parseFloat(item.volume || 0)
        });
    });
    
    console.log(`Processed data for ${availableStocks.length} symbols`);
    
    if (availableStocks.length === 0) {
        showError('No valid historical data found for any stocks');
    }
}

function showError(message) {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `<div class="error-message">${message}</div>`;
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

function showSuccess(message) {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `<div class="success-message">${message}</div>`;
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

function showInfo(message) {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `<div class="info-message">${message}</div>`;
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

function showLoading(show) {
    document.getElementById('loadingIndicator').style.display = show ? 'flex' : 'none';
}

function loadFilterSettings() {
    const savedSettings = JSON.parse(localStorage.getItem('consolidationFilterSettings') || '{}');
    
    // Load saved settings or use defaults
    document.getElementById('lookbackPeriod').value = savedSettings.lookbackPeriod || DEFAULT_LOOKBACK_PERIOD;
    document.getElementById('minPercentage').value = savedSettings.minPercentage !== undefined ? savedSettings.minPercentage : DEFAULT_MIN_PERCENTAGE;
    document.getElementById('maxPercentage').value = savedSettings.maxPercentage || DEFAULT_MAX_PERCENTAGE;
    
    if (savedSettings.checkVolume !== undefined) {
        document.getElementById('checkVolume').checked = savedSettings.checkVolume;
    }
    
    if (savedSettings.showBoughtStocks !== undefined) {
        document.getElementById('showBoughtStocks').checked = savedSettings.showBoughtStocks;
    }
}

function saveFilterSettings() {
    const settings = {
        lookbackPeriod: parseInt(document.getElementById('lookbackPeriod').value) || DEFAULT_LOOKBACK_PERIOD,
        minPercentage: parseFloat(document.getElementById('minPercentage').value) || DEFAULT_MIN_PERCENTAGE,
        maxPercentage: parseFloat(document.getElementById('maxPercentage').value) || DEFAULT_MAX_PERCENTAGE,
        checkVolume: document.getElementById('checkVolume').checked,
        showBoughtStocks: document.getElementById('showBoughtStocks').checked
    };
    
    localStorage.setItem('consolidationFilterSettings', JSON.stringify(settings));
} 