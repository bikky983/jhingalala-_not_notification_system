// Global variables
let availableStocks = [];
let folders = JSON.parse(localStorage.getItem('folders') || '["all"]');
let currentFolder = 'all';
let stockHistoricalData = {}; // To store historical data
let chartInstances = {}; // To store chart instances by symbol
let showOnlyWatchlist = false; // New variable for watchlist filter
let DEFAULT_QUANTITY = 10; // Default order quantity
let boughtStocks = JSON.parse(localStorage.getItem('boughtStocks') || '[]'); // Store bought stocks

// Use this to import D3 - modern approach
(function loadD3() {
    const script = document.createElement('script');
    script.src = 'https://d3js.org/d3.v7.min.js';
    script.async = false; // Keep it synchronous since charts depend on it
    document.head.appendChild(script);
})();

document.addEventListener('DOMContentLoaded', function() {
    // Initialize auto-refresh setting if not set (default to true)
    if (localStorage.getItem('autoRefreshEnabled') === null) {
        localStorage.setItem('autoRefreshEnabled', 'true');
    }
    
    // Store reference to common watchlist function to avoid naming conflicts
    // IMPORTANT: Save the reference before our own toggleWatchlist is exported
    if (typeof window.toggleWatchlist === 'function') {
        window.commonToggleWatchlist = window.toggleWatchlist;
        // Don't delete the original as other scripts may depend on it
    }
    
    initializeDashboard();
    setupEventListeners();
    startPriceUpdates();
    
    // Create chart popup element if not exists
    if (!document.querySelector('.chart-popup')) {
        createChartPopup();
    }
    
    // Add styles for watchlist and bought items
    addWatchlistStyles();
    
    // Fetch historical data
    fetchHistoricalData();
    
    // Initialize watchlist with our local function registered
    window.toggleWatchlist = toggleWatchlist; // Export our function
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

async function initializeDashboard() {
    migrateWatchlistData(); // Migrate existing data
    updateFolderOptions();
    showLoading(true);
    try {
        await Promise.all([
            fetchAvailableStocks(),
            loadUserStocks()
        ]);
    } catch (error) {
        showError('Failed to initialize dashboard');
        console.error('Initialization error:', error);
    }
    showLoading(false);
}

function setupEventListeners() {
    const symbolInput = document.getElementById('stockSymbol');
    symbolInput.addEventListener('input', (e) => updateSuggestions(e.target.value));

    document.getElementById('addStockBtn').addEventListener('click', addStock);
    document.getElementById('createFolderBtn').addEventListener('click', createFolder);
    document.getElementById('folderSelect').addEventListener('change', (e) => {
        currentFolder = e.target.value;
        loadUserStocks();
    });
    
    // Stock search input
    const searchInput = document.getElementById('stockSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleStockSearch);
    }
    
    // Filter stocks near support price button
    document.getElementById('filterSupportStocksBtn').addEventListener('click', () => {
        window.location.href = 'support-stocks.html';
    });

    // Add watchlist toggle button
    const excelButtonsDiv = document.querySelector('.excel-buttons');
    if (excelButtonsDiv) {
        // Create a container for toggle buttons if it doesn't exist
        let viewToggles = document.querySelector('.view-toggles');
        if (!viewToggles) {
            viewToggles = document.createElement('div');
            viewToggles.className = 'view-toggles';
            excelButtonsDiv.appendChild(viewToggles);
        }
        
        // Add watchlist toggle button
        const watchlistToggleBtn = document.createElement('button');
        watchlistToggleBtn.id = 'toggleWatchlistBtn';
        watchlistToggleBtn.className = 'toggle-btn';
        watchlistToggleBtn.textContent = 'Show Watchlist';
        watchlistToggleBtn.addEventListener('click', toggleWatchlistView);
        viewToggles.appendChild(watchlistToggleBtn);
        
        // Generate Order Code button for watchlist
        const generateOrderBtn = document.createElement('button');
        generateOrderBtn.id = 'generateOrderBtn';
        generateOrderBtn.className = 'toggle-btn';
        generateOrderBtn.textContent = 'Generate Order Code';
        generateOrderBtn.addEventListener('click', generateOrderCode);
        generateOrderBtn.style.display = 'none'; // Initially hidden
        viewToggles.appendChild(generateOrderBtn);
        
        // Add stoploss checkbox next to Generate Order Code button
        const stoplossLabel = document.createElement('label');
        stoplossLabel.className = 'stoploss-label';
        stoplossLabel.title = 'Add to Stoploss Page';
        stoplossLabel.style.display = 'none'; // Initially hidden
        stoplossLabel.innerHTML = `
            <input type="checkbox" id="addToStoplossCheck" checked>
            SL
        `;
        viewToggles.appendChild(stoplossLabel);
        
        // Load saved stoploss checkbox state
        const addToStoploss = localStorage.getItem('addToStoploss');
        if (addToStoploss !== null) {
            document.getElementById('addToStoplossCheck').checked = addToStoploss === 'true';
        }
        
        // Add event listener for stoploss checkbox
        const stoplossCheck = stoplossLabel.querySelector('#addToStoplossCheck');
        stoplossCheck.addEventListener('change', (e) => {
            localStorage.setItem('addToStoploss', e.target.checked);
        });
        
        // Auto-refresh toggle
        const autoRefreshBtn = document.createElement('button');
        autoRefreshBtn.id = 'autoRefreshBtn';
        autoRefreshBtn.className = 'toggle-btn';
        const isAutoRefreshEnabled = localStorage.getItem('autoRefreshEnabled') !== 'false';
        autoRefreshBtn.textContent = isAutoRefreshEnabled ? 'Disable Auto Refresh' : 'Enable Auto Refresh';
        autoRefreshBtn.addEventListener('click', toggleAutoRefresh);
        viewToggles.appendChild(autoRefreshBtn);
        
        // Create code output container
        let codeOutput = document.getElementById('codeOutput');
        if (!codeOutput) {
            codeOutput = document.createElement('div');
            codeOutput.id = 'codeOutput';
            codeOutput.className = 'code-output';
            codeOutput.innerHTML = `
                <h3>Generated Order Code</h3>
                <pre id="generatedCode"></pre>
                <div class="code-action-buttons">
                    <button id="copyCodeBtn">Copy to Clipboard</button>
                </div>
            `;
            document.querySelector('.dashboard-container').appendChild(codeOutput);
            document.getElementById('copyCodeBtn').addEventListener('click', copyToClipboard);
        }
    }

    document.getElementById('downloadExcel').addEventListener('click', function() {
        // Get user stocks
        const stocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
        
        // Get bought stocks info
        const boughtStocks = JSON.parse(localStorage.getItem('boughtStocks') || '[]');
        
        // Get support stocks history
        const supportStocksHistory = JSON.parse(localStorage.getItem('supportStocksHistory') || '{}');
        
        // Create enhanced stock data with bought status
        const enhancedStocks = stocks.map(stock => {
            // Check if this stock is in boughtStocks
            const boughtStock = boughtStocks.find(b => b.symbol === stock.symbol);
            
            // Return stock with additional bought information
            return {
                ...stock,
                isBought: boughtStock ? true : false,
                buyPrice: boughtStock ? boughtStock.buyPrice : null,
                buyDate: boughtStock ? boughtStock.buyDate : null,
                stoplossPrice: boughtStock ? boughtStock.stoplossPrice : null
            };
        });
        
        // Create worksheet with the enhanced data
        const worksheet = XLSX.utils.json_to_sheet(enhancedStocks);
        
        // Create a workbook with multiple sheets
        const workbook = XLSX.utils.book_new();
        
        // Add the stocks worksheet
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Stocks');
        
        // Create a worksheet for support history
        const historyData = Object.entries(supportStocksHistory).map(([key, date]) => {
            const [symbol, supportType] = key.split('_');
            return { symbol, supportType, firstSeen: date };
        });
        
        const historyWorksheet = XLSX.utils.json_to_sheet(historyData);
        XLSX.utils.book_append_sheet(workbook, historyWorksheet, 'SupportHistory');
        
        // Generate buffer and download
        XLSX.writeFile(workbook, 'stocks.xlsx');
    });

    document.getElementById('uploadExcel').addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Process the main Stocks sheet
            if (workbook.SheetNames.includes('Stocks')) {
                const worksheet = workbook.Sheets['Stocks'];
                const json = XLSX.utils.sheet_to_json(worksheet);
                
                // Extract user stocks and bought stocks
                const userStocks = [];
                const boughtStocks = [];
                
                json.forEach(stock => {
                    // Process watchlist and folder properties
                    if ('watchlist' in stock) {
                        stock.watchlist = Boolean(stock.watchlist);
                    } else {
                        stock.watchlist = false;
                    }
                    
                    if (!stock.folder) {
                        stock.folder = 'all';
                    }
                    
                    // Create a clean stock object for userStocks
                    const cleanStock = {
                        symbol: stock.symbol,
                        supportPrice1: stock.supportPrice1 || 0,
                        supportPrice2: stock.supportPrice2 || 0,
                        supportPrice3: stock.supportPrice3 || 0,
                        upperLimit: stock.upperLimit || 0,
                        folder: stock.folder,
                        watchlist: stock.watchlist
                    };
                    
                    userStocks.push(cleanStock);
                    
                    // If this stock is marked as bought, add to boughtStocks
                    if (stock.isBought) {
                        boughtStocks.push({
                            symbol: stock.symbol,
                            buyPrice: stock.buyPrice || 0,
                            buyDate: stock.buyDate || new Date().toISOString(),
                            stoplossPrice: stock.stoplossPrice || 0,
                            quantity: stock.quantity || 10
                        });
                    }
                });
                
                // Extract folders from the uploaded data
                const extractedFolders = [...new Set(userStocks.map(stock => stock.folder))];
                folders = ['all', ...extractedFolders.filter(f => f !== 'all')];
                localStorage.setItem('folders', JSON.stringify(folders));
                updateFolderOptions();
                
                // Save the stocks to localStorage
                localStorage.setItem('userStocks', JSON.stringify(userStocks));
                localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
                
                // Process support history if available
                if (workbook.SheetNames.includes('SupportHistory')) {
                    const historyWorksheet = workbook.Sheets['SupportHistory'];
                    const historyJson = XLSX.utils.sheet_to_json(historyWorksheet);
                    
                    const supportStocksHistory = {};
                    historyJson.forEach(item => {
                        const key = `${item.symbol}_${item.supportType}`;
                        supportStocksHistory[key] = item.firstSeen;
                    });
                    
                    localStorage.setItem('supportStocksHistory', JSON.stringify(supportStocksHistory));
                }
                
                // Display the stocks
                loadUserStocks();
                showSuccess('Stocks imported successfully!');
            } else {
                showError('Invalid Excel file: Stocks sheet not found');
            }
        };
        reader.readAsArrayBuffer(file);
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
    });
}

function createFolder() {
    const folderName = prompt('Enter folder name:');
    if (folderName && !folders.includes(folderName)) {
        folders.push(folderName);
        localStorage.setItem('folders', JSON.stringify(folders));
        updateFolderOptions();
    }
}

function updateFolderOptions() {
    const folderSelect = document.getElementById('folderSelect');
    folderSelect.innerHTML = '<option value="all">All Stocks</option>';
    folders.forEach(folder => {
        if (folder !== 'all') {
            const option = document.createElement('option');
            option.value = folder;
            option.textContent = folder;
            folderSelect.appendChild(option);
        }
    });
}

// Load stocks from localStorage with watchlist filter - optimized version
function loadUserStocks() {
    const stocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    
    // Apply filters
    let filteredStocks;
    
    if (showOnlyWatchlist) {
        // Watchlist filter
        filteredStocks = stocks.filter(stock => stock.watchlist === true);
        
        // Apply folder filter within watchlist if not "all"
        if (currentFolder !== 'all') {
            filteredStocks = filteredStocks.filter(stock => stock.folder === currentFolder);
        }
    } else {
        // Just apply folder filter
        filteredStocks = currentFolder === 'all' ? 
            stocks : 
            stocks.filter(stock => stock.folder === currentFolder);
    }
    
    // Display the filtered stocks
    displayUserStocks(filteredStocks);
}

// Save stocks to localStorage
function saveUserStocks(stocks) {
    localStorage.setItem('userStocks', JSON.stringify(stocks));
}

async function addStock() {
    const symbol = document.getElementById('stockSymbol').value.toUpperCase();
    const supportPrice1 = parseFloat(document.getElementById('supportPrice1').value);
    const supportPrice2 = parseFloat(document.getElementById('supportPrice2').value);
    const supportPrice3 = parseFloat(document.getElementById('supportPrice3').value);
    const upperLimit = parseFloat(document.getElementById('upperLimit').value);

    if (!validateStockInput(symbol, supportPrice1, supportPrice2, supportPrice3, upperLimit)) {
        return;
    }

    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    
    if (userStocks.some(stock => stock.symbol === symbol && stock.folder === currentFolder)) {
        showError('Stock already in this folder');
        return;
    }

    userStocks.push({
        symbol,
        supportPrice1,
        supportPrice2,
        supportPrice3,
        upperLimit,
        folder: currentFolder,
        watchlist: false, // Default: not in watchlist
        addedAt: new Date().toISOString()
    });

    saveUserStocks(userStocks);
    loadUserStocks();
    
    // Clear inputs
    document.getElementById('stockSymbol').value = '';
    document.getElementById('supportPrice1').value = '';
    document.getElementById('supportPrice2').value = '';
    document.getElementById('supportPrice3').value = '';
    document.getElementById('upperLimit').value = '';
    showSuccess('Stock added successfully');
}

async function displayUserStocks(stocks) {
    try {
        const prices = await fetchCurrentPrices();
        const tbody = document.querySelector('#stockTable tbody');
        tbody.innerHTML = '';

        if (stocks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" class="no-stocks">
                        ${showOnlyWatchlist ? 'No stocks in your watchlist. Add stocks to your watchlist first!' : 'No stocks in your portfolio. Add some stocks above!'}
                    </td>
                </tr>`;
            return;
        }

        // Clean up old chart instances
        Object.keys(chartInstances).forEach(symbol => {
            if (chartInstances[symbol] && chartInstances[symbol].chart) {
                chartInstances[symbol].chart.remove();
                delete chartInstances[symbol];
            }
        });

        stocks.forEach(stock => {
            const currentPrice = prices[stock.symbol] || 0;
            const difference1 = calculateDifference(currentPrice, stock.supportPrice1);
            const difference2 = calculateDifference(currentPrice, stock.supportPrice2);
            const difference3 = calculateDifference(currentPrice, stock.supportPrice3);
            const upperLimitDiff = calculateUpperLimitDifference(currentPrice, stock.upperLimit);
            
            // Create the main row
            const row = document.createElement('tr');
            row.dataset.symbol = stock.symbol;
            
            // Add watchlist class if in watchlist
            if (stock.watchlist) {
                row.classList.add('watchlist-item');
            }
            
            // Format numbers to avoid excess decimals
            const formatNumber = (num) => {
                if (num === null || num === undefined) return '';
                return parseFloat(num).toFixed(2);
            };
            
            row.innerHTML = `
                <td>${stock.symbol}</td>
                <td>${formatNumber(currentPrice)}</td>
                <td>${formatNumber(stock.supportPrice1)}</td>
                <td class="${getDifferenceClass(difference1)}">${difference1}%</td>
                <td>${formatNumber(stock.supportPrice2)}</td>
                <td class="${getDifferenceClass(difference2)}">${difference2}%</td>
                <td>${formatNumber(stock.supportPrice3)}</td>
                <td class="${getDifferenceClass(difference3)}">${difference3}%</td>
                <td>${formatNumber(stock.upperLimit)}</td>
                <td class="${currentPrice > stock.upperLimit ? 'upper-limit-exceeded' : ''}">${upperLimitDiff}%</td>
                <td>
                    <button data-watchlist="${stock.symbol}" onclick="toggleWatchlist('${stock.symbol}')" class="action-btn watchlist-btn ${stock.watchlist ? 'active' : ''}" title="${stock.watchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}">${stock.watchlist ? '★' : '☆'}</button>
                    <button data-bought="${stock.symbol}" onclick="toggleBought('${stock.symbol}')" class="action-btn bought-btn ${isBoughtStock(stock.symbol) ? 'active' : ''}" title="${isBoughtStock(stock.symbol) ? 'Mark as Not Bought' : 'Mark as Bought'}">🛒</button>
                    <button onclick="editStock('${stock.symbol}')" class="action-btn edit-btn">Edit</button>
                    <button onclick="deleteStock('${stock.symbol}')" class="action-btn delete-btn">Delete</button>
                    <button onclick="showFullScreenChart('${stock.symbol}')" class="action-btn chart-btn">Chart</button>
                </td>
                <td class="chart-cell">
                    <div id="chart-container-${stock.symbol}" class="chart-container-small"></div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // After all rows are created, initialize charts
        setTimeout(() => {
            stocks.forEach(stock => {
                initializeStockChart(stock.symbol);
            });
        }, 100);
    } catch (error) {
        showError('Error displaying stocks');
        console.error('Display error:', error);
    }
}

// Function to downsample data points - keeps visual accuracy while reducing points
function downsampleData(data, threshold = 500) {
    if (data.length <= threshold) return data;
    
    // Simple method: take every nth item
    const n = Math.ceil(data.length / threshold);
    return data.filter((_, i) => i % n === 0);
    
    // For more sophisticated downsampling, implement LTTB algorithm
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
    const displayData = downsampleData(data, 200); // Original value
    
    // Get support prices for this symbol
    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    const stockData = userStocks.find(s => s.symbol === symbol);
    const supportPrices = stockData ? [
        stockData.supportPrice1, 
        stockData.supportPrice2, 
        stockData.supportPrice3
    ].filter(p => p && !isNaN(p)) : [];
    
    // Set up dimensions - original height
    const width = chartContainer.clientWidth;
    const height = 200; // Original height
    const margin = {top: 20, right: 20, bottom: 30, left: 40}; // Original margins
    
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
    
    // Y scale - ensure support prices are included in the domain
    const minY = Math.min(
        d3.min(displayData, d => d.low) * 0.99,
        ...supportPrices.map(p => p * 0.99)
    );
    const maxY = Math.max(
        d3.max(displayData, d => d.high) * 1.01, 
        ...supportPrices.map(p => p * 1.01)
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
        .attr("stroke-width", 2) // Original value
        .attr("d", line);
    
    // Add support price lines
    const supportColors = ["#1976D2", "#7B1FA2", "#FFA000"];
    
    supportPrices.forEach((price, index) => {
        if (price && !isNaN(price)) {
            // Add support price line
            svg.append("line")
                .attr("x1", margin.left)
                .attr("x2", width - margin.right)
                .attr("y1", y(price))
                .attr("y2", y(price))
                .attr("stroke", supportColors[index % supportColors.length])
                .attr("stroke-width", 1.5) // Original value
                .attr("stroke-dasharray", "3,3"); // Original dash pattern
        }
    });
    
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
    
    // Process data - use more data points for full screen
    const data = stockHistoricalData[symbol];
    
    // Downsample for large datasets but keep more points for detailed view
    const displayData = downsampleData(data, 1000); // Keep max 1000 points for full screen
    
    // Get support prices for this symbol
    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    const stockData = userStocks.find(s => s.symbol === symbol);
    const supportPrices = stockData ? [
        stockData.supportPrice1, 
        stockData.supportPrice2, 
        stockData.supportPrice3
    ].filter(p => p && !isNaN(p)) : [];
    
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
        
        // Y scale - ensure support prices are included in the domain if needed
        const minY = Math.min(
            d3.min(displayData, d => d.low) * 0.99,
            ...supportPrices.map(p => p * 0.99)
        );
        const maxY = Math.max(
            d3.max(displayData, d => d.high) * 1.01, 
            ...supportPrices.map(p => p * 1.01)
        );
        
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
        
        // Add support price lines
        const supportColors = ["#1976D2", "#7B1FA2", "#FFA000"];
        const supportNames = ["Support 1", "Support 2", "Support 3"];
        
        supportPrices.forEach((price, index) => {
            if (price && !isNaN(price)) {
                // Add support price line
                svg.append("line")
                    .attr("x1", margin.left)
                    .attr("x2", width - margin.right)
                    .attr("y1", y(price))
                    .attr("y2", y(price))
                    .attr("stroke", supportColors[index % supportColors.length])
                    .attr("stroke-width", 2)
                    .attr("stroke-dasharray", "5,5");
                
                // Add support price label
                svg.append("text")
                    .attr("x", width - margin.right + 5)
                    .attr("y", y(price) + 4)
                    .attr("fill", supportColors[index % supportColors.length])
                    .attr("font-size", "12px")
                    .attr("text-anchor", "start")
                    .text(`${supportNames[index]}: ${price}`);
            }
        });
        
        // Store reference to destroy on close
        popupContainer.chart = svg.node();
    }, 100);
}

function getDifferenceClass(difference) {
    if (difference < 0) return 'negative';
    if (difference < 12) return 'positive-low';
    return 'positive';
}

function deleteStock(symbol) {
    if (!confirm(`Are you sure you want to delete ${symbol}?`)) {
        return;
    }

    let stocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    stocks = stocks.filter(stock => stock.symbol !== symbol);
    saveUserStocks(stocks);
    
    // Destroy chart instance if exists
    if (chartInstances[symbol] && chartInstances[symbol].chart) {
        chartInstances[symbol].chart.remove();
        delete chartInstances[symbol];
    }
    
    // Reload stocks with current filters instead of displaying all stocks
    loadUserStocks();
    showSuccess('Stock removed successfully');
}

function editStock(symbol) {
    let stocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    const stock = stocks.find(s => s.symbol === symbol);
    
    if (!stock) return;

    const newSupportPrice1 = prompt(`Enter new support price for ${symbol} (current: ${stock.supportPrice1}):`);
    if (newSupportPrice1 && !isNaN(newSupportPrice1)) {
        stock.supportPrice1 = parseFloat(newSupportPrice1);
    }

    const newSupportPrice2 = prompt(`Enter new support price for ${symbol} (current: ${stock.supportPrice2}):`);
    if (newSupportPrice2 && !isNaN(newSupportPrice2)) {
        stock.supportPrice2 = parseFloat(newSupportPrice2);
    }

    const newSupportPrice3 = prompt(`Enter new support price for ${symbol} (current: ${stock.supportPrice3}):`);
    if (newSupportPrice3 && !isNaN(newSupportPrice3)) {
        stock.supportPrice3 = parseFloat(newSupportPrice3);
    }

    const newUpperLimit = prompt(`Enter new upper limit for ${symbol} (current: ${stock.upperLimit}):`);
    if (newUpperLimit && !isNaN(newUpperLimit)) {
        stock.upperLimit = parseFloat(newUpperLimit);
    }

    // No need to prompt for watchlist - that's handled by the toggle button
    
    saveUserStocks(stocks);
    loadUserStocks();
    showSuccess('Stock updated successfully');
}

// Fetch historical data from the JSON file
async function fetchHistoricalData() {
    try {
        showLoading(true);
        const response = await fetch('/organized_nepse_data.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Fetched data:", data);
        
        // Process the data
        processHistoricalData(data);
        
        showLoading(false);
    } catch (error) {
        console.error('Error fetching historical data:', error);
        showError('Failed to load historical price data: ' + error.message);
        showLoading(false);
    }
}

// Process historical data more efficiently
function processHistoricalData(data) {
    console.log("Processing historical data");
    
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
            close: parseFloat(item.close)
        });
    });
    
    // Log the result
    console.log("Processed data for symbols:", Object.keys(stockHistoricalData));
    
    // Pre-sort data for each symbol
    for (const symbol in stockHistoricalData) {
        if (stockHistoricalData[symbol].length > 5000) {
            console.log(`${symbol} has ${stockHistoricalData[symbol].length} data points - consider filtering`);
        }
    }
}

// Helper functions
function calculateDifference(current, support) {
    if (current > support) {
        // If LTP is greater than support price, show positive percentage
        return ((current - support) / support * 100).toFixed(2);
    } else {
        // If LTP is less than support price, show negative percentage
        return (-((support - current) / support * 100)).toFixed(2);
    }
}

function calculateUpperLimitDifference(current, upperLimit) {
    return ((current - upperLimit) / upperLimit * 100).toFixed(2);
}

function showError(message) {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `
        <div class="error-message">
            ${message}
            <button onclick="this.parentElement.remove()" class="close-btn">×</button>
        </div>
    `;
}

function showSuccess(message) {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `
        <div class="success-message">
            ${message}
            <button onclick="this.parentElement.remove()" class="close-btn">×</button>
        </div>
    `;
}

function showLoading(show) {
    document.getElementById('loadingIndicator').style.display = show ? 'block' : 'none';
}

// API calls
async function fetchAvailableStocks() {
    try {
        const response = await fetch('/api/stocks');
        availableStocks = await response.json();
        updateSuggestions('');
    } catch (error) {
        console.error('Error fetching stocks:', error);
        showError('Failed to fetch available stocks');
    }
}

async function fetchCurrentPrices() {
    try {
        const response = await fetch('/api/prices');
        const prices = await response.json();
        
        // Store prices in localStorage for other pages to use
        localStorage.setItem('currentPrices', JSON.stringify(prices));
        
        return prices;
    } catch (error) {
        console.error('Error fetching prices:', error);
        return {};
    }
}

// Update stock suggestions
function updateSuggestions(input) {
    const datalist = document.getElementById('stockSuggestions');
    datalist.innerHTML = '';
    
    const filteredStocks = availableStocks.filter(stock => 
        stock.symbol.toLowerCase().includes(input.toLowerCase()) ||
        stock.name.toLowerCase().includes(input.toLowerCase())
    );

    filteredStocks.forEach(stock => {
        const option = document.createElement('option');
        option.value = stock.symbol;
        option.label = `${stock.symbol} - ${stock.name}`;
        datalist.appendChild(option);
    });
}

function validateStockInput(symbol, supportPrice1, supportPrice2, supportPrice3, upperLimit) {
    if (!symbol || !supportPrice1 || !supportPrice2 || !supportPrice3 || !upperLimit) {
        showError('Please enter symbol, all support prices, and upper limit');
        return false;
    }

    if (!availableStocks.some(stock => stock.symbol === symbol)) {
        showError('Please enter a valid stock symbol');
        return false;
    }

    if (supportPrice1 <= 0 || supportPrice2 <= 0 || supportPrice3 <= 0 || upperLimit <= 0) {
        showError('Prices must be greater than 0');
        return false;
    }

    return true;
}

// Add this function to ensure periodic updates
function startPriceUpdates() {
    // Check if auto-refresh is enabled (default is true)
    const autoRefreshEnabled = localStorage.getItem('autoRefreshEnabled') !== 'false';
    
    // Store the interval ID so we can clear it if needed
    window.priceUpdateInterval = setInterval(async () => {
        // Check again in case setting was changed
        if (localStorage.getItem('autoRefreshEnabled') !== 'false') {
            const stocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
            await displayUserStocks(stocks);
        }
    }, 60000); // Adjust the interval as needed
}

// Function to toggle auto-refresh
function toggleAutoRefresh() {
    const currentSetting = localStorage.getItem('autoRefreshEnabled') !== 'false';
    const newSetting = !currentSetting;
    
    localStorage.setItem('autoRefreshEnabled', newSetting);
    
    // Update button text
    const autoRefreshBtn = document.getElementById('autoRefreshBtn');
    if (autoRefreshBtn) {
        autoRefreshBtn.textContent = newSetting ? 'Disable Auto Refresh' : 'Enable Auto Refresh';
    }
    
    // Show confirmation message
    showSuccess(newSetting ? 'Auto refresh enabled' : 'Auto refresh disabled');
}

// Toggle watchlist status for a stock - optimized version
function toggleWatchlist(symbol) {
    // Check if this is the dashboard implementation being called by the common implementation
    // We use a static flag to prevent recursion
    if (toggleWatchlist._isProcessing) {
        return;
    }
    
    // Use the common function if available, but be careful about recursion
    if (typeof window.commonToggleWatchlist === 'function' && window.commonToggleWatchlist !== toggleWatchlist) {
        try {
            // Set flag to prevent recursive calls
            toggleWatchlist._isProcessing = true;
            
            // Call the common function
            window.commonToggleWatchlist(symbol);
            
            // Force refresh of the view with current filters if in watchlist view
            if (showOnlyWatchlist) {
                setTimeout(() => loadUserStocks(), 100);
            }
        } finally {
            // Always clear the flag
            toggleWatchlist._isProcessing = false;
        }
        return;
    }
    
    // Fallback to local implementation
    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    const stockIndex = userStocks.findIndex(stock => stock.symbol === symbol);
    
    if (stockIndex !== -1) {
        // Toggle the watchlist status
        userStocks[stockIndex].watchlist = !userStocks[stockIndex].watchlist;
        const isWatchlisted = userStocks[stockIndex].watchlist;
        
        // Save changes
        saveUserStocks(userStocks);
        
        // Update button appearance without reloading everything
        const button = document.querySelector(`button[data-watchlist="${symbol}"]`);
        if (button) {
            if (isWatchlisted) {
                button.classList.add('active');
                button.title = 'Remove from Watchlist';
                button.textContent = '★';
            } else {
                button.classList.remove('active');
                button.title = 'Add to Watchlist';
                button.textContent = '☆';
            }
        }
        
        // Update row appearance
        const row = document.querySelector(`tr[data-symbol="${symbol}"]`);
        if (row) {
            if (isWatchlisted) {
                row.classList.add('watchlist-item');
            } else {
                row.classList.remove('watchlist-item');
                
                // If in watchlist-only view and removing from watchlist, reload to remove it properly
                if (showOnlyWatchlist) {
                    loadUserStocks();
                }
            }
        }
        
        // Show feedback to user
        showSuccess(isWatchlisted ? 
            `${symbol} added to watchlist` : 
            `${symbol} removed from watchlist`);
    }
}

// Initialize the recursion protection flag
toggleWatchlist._isProcessing = false;

// Toggle watchlist-only view - optimized version
function toggleWatchlistView() {
    showOnlyWatchlist = !showOnlyWatchlist;
    
    // Update button appearance
    const button = document.getElementById('toggleWatchlistBtn');
    if (button) {
        if (showOnlyWatchlist) {
            button.classList.add('active');
            button.textContent = 'Show All Stocks';
        } else {
            button.classList.remove('active');
            button.textContent = 'Show Watchlist';
        }
    }
    
    // Show/hide Generate Order Code button
    const generateOrderBtn = document.getElementById('generateOrderBtn');
    if (generateOrderBtn) {
        generateOrderBtn.style.display = showOnlyWatchlist ? 'block' : 'none';
    }
    
    // Show/hide stoploss checkbox
    const stoplossLabel = document.querySelector('.stoploss-label');
    if (stoplossLabel) {
        stoplossLabel.style.display = showOnlyWatchlist ? 'inline-flex' : 'none';
    }
    
    // Reload with filter applied
    loadUserStocks();
    
    // Show feedback
    showSuccess(showOnlyWatchlist ? 
        'Showing watchlist stocks only' : 
        'Showing all stocks');
}

// Add this to the initializeDashboard function
function migrateWatchlistData() {
    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    let needsUpdate = false;
    
    userStocks.forEach(stock => {
        if (!('watchlist' in stock)) {
            stock.watchlist = false;
            needsUpdate = true;
        }
    });
    
    if (needsUpdate) {
        saveUserStocks(userStocks);
    }
}

// Stock search functionality
function handleStockSearch() {
    const searchValue = document.getElementById('stockSearchInput').value.toUpperCase();
    const rows = document.querySelectorAll('#stockTable tbody tr');
    
    rows.forEach(row => {
        const symbol = row.getAttribute('data-symbol');
        if (symbol && symbol.includes(searchValue)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Add Generate Order Code functionality from support-stocks.js
function generateOrderCode() {
    // Get all watchlisted stocks
    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    const watchlistStocks = userStocks.filter(stock => stock.watchlist === true);
    
    if (watchlistStocks.length === 0) {
        showError('No stocks in watchlist for order generation');
        return;
    }
    
    // Create order code using latest prices
    fetchCurrentPrices().then(prices => {
        // Prepare stocks array with prices
        const selectedStocks = watchlistStocks.map(stock => ({
            symbol: stock.symbol,
            ltp: prices[stock.symbol] || 0,
            // Use support price as buy price (the lowest non-zero one, if available)
            buyPrice: getBuyPrice(stock, prices[stock.symbol] || 0),
            selected: true
        }));
        
        // Check if we should add to stoploss
        const addToStoplossCheck = document.getElementById('addToStoplossCheck');
        const addToStoploss = addToStoplossCheck ? addToStoplossCheck.checked : true;
        
        // Add selected stocks to boughtStocks if they're not already there
        const boughtStocks = JSON.parse(localStorage.getItem('boughtStocks') || '[]');
        let boughtStocksUpdated = false;
        let newStocksCount = 0;
        
        if (addToStoploss) {
            selectedStocks.forEach(selected => {
                const existingIndex = boughtStocks.findIndex(stock => stock.symbol === selected.symbol);
                
                if (existingIndex === -1) {
                    // Add new stock to boughtStocks
                    boughtStocks.push({
                        symbol: selected.symbol,
                        buyPrice: selected.buyPrice,
                        buyDate: new Date().toISOString(),
                        stoplossPrice: selected.buyPrice * 0.85, // Default 15% stoploss
                        quantity: DEFAULT_QUANTITY
                    });
                    boughtStocksUpdated = true;
                    newStocksCount++;
                }
            });
            
            // Save updated boughtStocks if changes were made
            if (boughtStocksUpdated) {
                localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
                showSuccess(`Added ${newStocksCount} watchlisted stocks to Stoploss Tracker`);
            }
        }
        
        // Create the code
        let code = `// TMS Order Placement - Generated on ${new Date().toLocaleString()}\n`;
        code += `// Paste this entire block into your browser console\n\n`;
        
        // Include the order function
        code += getOrderPlacerFunction();
        
        // Create a chain of promises
        code += `\n// Stock orders\n`;
        
        selectedStocks.forEach((stock, index) => {
            if (index === 0) {
                code += `placeOrder('${stock.symbol}', ${DEFAULT_QUANTITY}, ${stock.buyPrice.toFixed(2)})`;
            } else {
                code += `\n  .then(() => placeOrder('${stock.symbol}', ${DEFAULT_QUANTITY}, ${stock.buyPrice.toFixed(2)}))`;
            }
        });
        
        code += `\n  .then(result => console.log('All orders completed!'));\n`;
        
        // Show the code
        document.getElementById('generatedCode').textContent = code;
        
        // Update code action buttons to include stoploss link
        const codeActionButtons = document.querySelector('.code-action-buttons');
        if (codeActionButtons) {
            // Check if the stoploss link already exists
            if (!document.getElementById('viewStoplossBtn')) {
                const viewStoplossBtn = document.createElement('button');
                viewStoplossBtn.id = 'viewStoplossBtn';
                viewStoplossBtn.textContent = 'View in Stoploss Tracker';
                viewStoplossBtn.style.marginLeft = '10px';
                viewStoplossBtn.style.backgroundColor = '#673ab7';
                viewStoplossBtn.addEventListener('click', () => {
                    window.location.href = 'stoploss.html?from_watchlist=true';
                });
                codeActionButtons.appendChild(viewStoplossBtn);
            }
        }
        
        document.getElementById('codeOutput').style.display = 'block';
    });
}

// Get the best buy price for a stock (support price closest to current price)
function getBuyPrice(stock, currentPrice) {
    // Filter out invalid support prices
    const supportPrices = [
        { value: stock.supportPrice1, index: 1 }, 
        { value: stock.supportPrice2, index: 2 }, 
        { value: stock.supportPrice3, index: 3 }
    ].filter(p => p.value && !isNaN(p.value) && p.value > 0);
    
    if (supportPrices.length > 0) {
        // Calculate the difference between each support price and current price
        supportPrices.forEach(p => {
            p.diff = Math.abs(p.value - currentPrice);
        });
        
        // Sort by difference (smallest first)
        supportPrices.sort((a, b) => a.diff - b.diff);
        
        // Return the support price closest to current LTP
        return supportPrices[0].value;
    }
    
    // If no support prices, use current price
    return currentPrice;
}

// Copy the generated code to clipboard
function copyToClipboard() {
    const codeElement = document.getElementById('generatedCode');
    const codeText = codeElement.textContent;
    
    if (!codeText) {
        showError('No code to copy');
        return;
    }
    
    // Create a temporary textarea element to copy from
    const textarea = document.createElement('textarea');
    textarea.value = codeText;
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        // Copy the text
        document.execCommand('copy');
        showSuccess('Code copied to clipboard');
    } catch (err) {
        showError('Failed to copy code');
        console.error('Copy error:', err);
    }
    
    // Remove the textarea
    document.body.removeChild(textarea);
}

// Order placer function from support-stocks.js
function getOrderPlacerFunction() {
    return `// Order placement function
function placeOrder(symbol, quantity, price) {
  try {
    // Element selectors identified through the inspector
    const symbolElement = document.evaluate('/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[3]/form/div[2]/div[2]/input', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const quantityElement = document.evaluate('/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[3]/form/div[2]/div[3]/input', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const priceElement = document.evaluate('/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[3]/form/div[2]/div[4]/input', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const buyToggleElement = document.evaluate('/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div/div[2]/app-three-state-toggle/div/div/label[3]/input', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const buyButtonElement = document.evaluate('/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[3]/form/div[3]/div[2]/button', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    
    // First, set buy toggle
    if (buyToggleElement && !buyToggleElement.checked) {
      buyToggleElement.checked = true;
      buyToggleElement.dispatchEvent(new Event('change', { bubbles: true }));
      buyToggleElement.dispatchEvent(new Event('click', { bubbles: true }));
      console.log("Buy toggle activated");
    }
    
    // Then set symbol and press Enter
    if (symbolElement) {
      return new Promise(resolve => {
        // Focus on the element first
        symbolElement.focus();
        
        // Set the value
        symbolElement.value = symbol;
        
        // Dispatch events to ensure value is recognized
        symbolElement.dispatchEvent(new Event('input', { bubbles: true }));
        symbolElement.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Wait 1 second before pressing Enter
        setTimeout(() => {
          // Simulate pressing Enter key
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          symbolElement.dispatchEvent(enterEvent);
          
          // Also dispatch a keypress and keyup event
          symbolElement.dispatchEvent(new KeyboardEvent('keypress', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
          }));
          
          symbolElement.dispatchEvent(new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
          }));
          
          console.log(\`Script \${symbol} entered\`);
          
          // Wait another second before showing popup and setting values
          setTimeout(() => {
            // Create popup form for order configuration
            const popupForm = document.createElement('div');
            popupForm.id = 'orderConfigPopup';
            popupForm.style.cssText = 'position:fixed;top:10px;left:10px;width:auto;height:auto;background:transparent;z-index:10000;';
            
            const formContent = document.createElement('div');
            formContent.style.cssText = 'background:white;padding:15px;border-radius:5px;width:250px;box-shadow:0 0 10px rgba(0,0,0,0.3);border:1px solid #ccc;';
            formContent.innerHTML = \`
              <h3 style="margin-top:0;text-align:center;font-size:14px;margin-bottom:10px;">Order Configuration - \${symbol}</h3>
              <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:3px;font-weight:bold;font-size:12px;">Quantity:</label>
                <input type="number" id="popupQuantity" value="\${quantity}" style="width:100%;padding:5px;box-sizing:border-box;border:1px solid #ccc;">
              </div>
              <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:3px;font-weight:bold;font-size:12px;">Price:</label>
                <input type="number" step="0.01" id="popupPrice" value="\${price}" style="width:100%;padding:5px;box-sizing:border-box;border:1px solid #ccc;">
              </div>
              <div style="display:flex;justify-content:space-between;">
                <button id="popupCancelBtn" style="padding:5px 10px;background:#f44336;color:white;border:none;border-radius:3px;cursor:pointer;font-size:12px;">Cancel</button>
                <button id="popupConfirmBtn" style="padding:5px 10px;background:#4caf50;color:white;border:none;border-radius:3px;cursor:pointer;font-size:12px;">Confirm</button>
              </div>
            \`;
            
            popupForm.appendChild(formContent);
            document.body.appendChild(popupForm);
            
            // Focus on quantity input
            setTimeout(() => {
              document.getElementById('popupQuantity').focus();
            }, 100);
            
            // Handle cancel button
            document.getElementById('popupCancelBtn').addEventListener('click', () => {
              document.body.removeChild(popupForm);
              console.log("Order cancelled by user");
              resolve(false);
            });
            
            // Handle confirm button
            document.getElementById('popupConfirmBtn').addEventListener('click', () => {
              // Get values from popup
              const popupQuantity = parseInt(document.getElementById('popupQuantity').value) || quantity;
              const popupPrice = parseFloat(document.getElementById('popupPrice').value) || price;
              
              // Remove popup
              document.body.removeChild(popupForm);
              
              // Set quantity
              if (quantityElement) {
                quantityElement.value = popupQuantity;
                quantityElement.dispatchEvent(new Event('input', { bubbles: true }));
                quantityElement.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(\`Quantity set to \${popupQuantity}\`);
              }
              
              // Set price
              if (priceElement) {
                priceElement.value = popupPrice;
                priceElement.dispatchEvent(new Event('input', { bubbles: true }));
                priceElement.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(\`Price set to \${popupPrice}\`);
              }
              
              // Confirm before executing
              if (confirm(\`Ready to place order: \${popupQuantity} shares of \${symbol} at \${popupPrice}?\`)) {
                // Wait 1 second before clicking the buy button
                setTimeout(() => {
                  // Click buy button
                  if (buyButtonElement) {
                    buyButtonElement.click();
                    console.log(\`Order submitted: \${popupQuantity} shares of \${symbol} at \${popupPrice}\`);
                    setTimeout(() => resolve(true), 1000); // Wait a second before resolving
                  } else {
                    console.error("Buy button not found");
                    resolve(false);
                  }
                }, 1000); // 1-second delay before clicking buy button
              } else {
                console.log("Order cancelled by user");
                resolve(false);
              }
            });
            
            // Add keypress handler for Enter key
            document.getElementById('popupPrice').addEventListener('keypress', (e) => {
              if (e.key === 'Enter') {
                document.getElementById('popupConfirmBtn').click();
              }
            });
            
            document.getElementById('popupQuantity').addEventListener('keypress', (e) => {
              if (e.key === 'Enter') {
                document.getElementById('popupPrice').focus();
              }
            });
            
          }, 1000); // 1-second delay after entering symbol
    }, 1000); // THIS CLOSING BRACE AND TIMEOUT VALUE WAS ADDED HERE - proper closure of the outer setTimeout
  });
      } else {
        console.error("Symbol element not found");
        return Promise.resolve(false);
      }
    } catch (error) {
      console.error("Error placing order:", error);
      return Promise.resolve(false);
    }
}`;
}

// Check if a stock is marked as bought
function isBoughtStock(symbol) {
    return boughtStocks.some(stock => stock.symbol === symbol);
}

// Toggle bought status for a stock
function toggleBought(symbol) {
    // Find stock in userStocks
    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    const stock = userStocks.find(s => s.symbol === symbol);
    
    if (!stock) return;
    
    // Get current price for the stock
    const currentPrice = getCurrentPrice(symbol) || 0;
    
    // Check if already bought
    const boughtIndex = boughtStocks.findIndex(s => s.symbol === symbol);
    
    if (boughtIndex === -1) {
        // Add to bought stocks
        const boughtStock = {
            symbol: symbol,
            buyPrice: currentPrice,
            buyDate: new Date().toISOString(),
            quantity: DEFAULT_QUANTITY
        };
        
        boughtStocks.push(boughtStock);
        showSuccess(`${symbol} marked as bought at ${currentPrice.toFixed(2)}`);
    } else {
        // Remove from bought stocks
        boughtStocks.splice(boughtIndex, 1);
        showSuccess(`${symbol} marked as not bought`);
    }
    
    // Save to localStorage
    localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
    
    // Refresh the display
    loadUserStocks();
}

// Helper to get current price for a stock
function getCurrentPrice(symbol) {
    const prices = JSON.parse(localStorage.getItem('currentPrices') || '{}');
    return prices[symbol] || 0;
}

// Add styles for watchlist items if not already present
function addWatchlistStyles() {
    // Check if the styles are already added
    if (document.getElementById('watchlist-styles')) return;
    
    // Create style element
    const style = document.createElement('style');
    style.id = 'watchlist-styles';
    style.textContent = `
        .watchlist-item {
            background-color: rgba(33, 150, 243, 0.1) !important;
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
        
        /* Bought button styles */
        .bought-btn {
            background-color: #eee;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 4px 8px;
            margin-right: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        
        .bought-btn.active {
            background-color: #4caf50;
            color: white;
            border-color: #388e3c;
        }
        
        .bought-btn:hover {
            background-color: #e0e0e0;
        }
        
        .bought-btn.active:hover {
            background-color: #43a047;
        }
        
        /* Stoploss checkbox styling */
        .stoploss-label {
            display: inline-flex;
            align-items: center;
            background-color: #e91e63;
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            margin-left: 5px;
        }
        
        .stoploss-label:hover {
            background-color: #c2185b;
        }
        
        .stoploss-label input {
            margin-right: 5px;
        }
    `;
    
    // Add to document head
    document.head.appendChild(style);
}
