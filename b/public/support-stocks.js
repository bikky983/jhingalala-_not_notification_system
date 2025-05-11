// Global variables
let userStocks = [];
let currentPrices = {};
let supportStocks = [];
let stockHistoricalData = {}; // To store historical data
let chartInstances = {}; // To store chart instances by symbol
let supportStocksHistory = JSON.parse(localStorage.getItem('supportStocksHistory') || '{}'); // Track stocks near support
let boughtStocks = JSON.parse(localStorage.getItem('boughtStocks') || '[]'); // Track bought stocks
let autoRefreshInterval = null;
const DEFAULT_QUANTITY = 10;
const NEW_BADGE_DAYS = 3; // Show "New" badge for stocks added in the last 3 days
const DEFAULT_MIN_FILTER_PERCENTAGE = 0; // Default minimum filter percentage
const DEFAULT_MAX_FILTER_PERCENTAGE = 2; // Default maximum filter percentage

document.addEventListener('DOMContentLoaded', function() {    
    // Get any watchlist selections from localStorage
    supportStocksHistory = JSON.parse(localStorage.getItem('supportStocksHistory') || '{}');
    
    loadSavedFilterSettings();
    loadUserStocks();
    setupEventListeners();
    
    // Load saved stoploss checkbox state
    const addToStoploss = localStorage.getItem('addToStoploss');
    if (addToStoploss !== null) {
        document.getElementById('addToStoplossCheck').checked = addToStoploss === 'true';
    }
    
    // Start with an initial load
    loadCurrentPrices();
    filterStocksNearSupport();
    
    // Setup auto-refresh initially
    setupAutoRefresh();
    
    // Register our local toggleWatchlist function globally
    window.toggleWatchlist = toggleWatchlist;
    window.isInWatchlist = function(symbol) {
        const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
        return userStocks.some(stock => stock.symbol === symbol && stock.watchlist === true);
    };
    
    // Create chart popup element if not exists
    if (!document.querySelector('.chart-popup')) {
        createChartPopup();
    }
    
    // Fetch historical data
    fetchHistoricalData();
    
    // Add styles for watchlist items if not already present
    addWatchlistStyles();
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
    filterStocksNearSupport();
}

function setupEventListeners() {
    document.getElementById('refreshSupportListBtn').addEventListener('click', () => {
        loadCurrentPrices();
        filterStocksNearSupport();
    });
    
    document.getElementById('generateOrderCodeBtn').addEventListener('click', generateOrderCode);
    document.getElementById('copyCodeBtn').addEventListener('click', copyToClipboard);
    
    // Add event listener for addToStoplossCheck to save state
    document.getElementById('addToStoplossCheck').addEventListener('change', (e) => {
        localStorage.setItem('addToStoploss', e.target.checked);
    });
    
    // Auto-refresh toggle
    const autoRefreshBtn = document.getElementById('autoRefreshBtn');
    const isAutoRefreshEnabled = localStorage.getItem('autoRefreshEnabled') === 'true';
    autoRefreshBtn.textContent = isAutoRefreshEnabled ? 'Disable Auto Refresh' : 'Enable Auto Refresh';
    autoRefreshBtn.addEventListener('click', toggleAutoRefresh);
    
    // Filter checkboxes
    document.getElementById('filterSupport1').addEventListener('change', filterStocksNearSupport);
    document.getElementById('filterSupport2').addEventListener('change', filterStocksNearSupport);
    document.getElementById('filterSupport3').addEventListener('change', filterStocksNearSupport);
    
    // Filter inputs with enter key support
    document.getElementById('filterMinPercentage').addEventListener('change', () => {
        saveFilterSettings();
        filterStocksNearSupport();
    });
    document.getElementById('filterMinPercentage').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveFilterSettings();
            filterStocksNearSupport();
        }
    });
    
    document.getElementById('filterMaxPercentage').addEventListener('change', () => {
        saveFilterSettings();
        filterStocksNearSupport();
    });
    document.getElementById('filterMaxPercentage').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveFilterSettings();
            filterStocksNearSupport();
        }
    });
    
    // Manual stock entry
    document.getElementById('addManualStockBtn').addEventListener('click', showManualStockForm);
    document.getElementById('saveManualStockBtn').addEventListener('click', saveManualStock);
    document.getElementById('cancelManualStockBtn').addEventListener('click', hideManualStockForm);
    
    // Add enter key support for the manual stock symbol input
    document.getElementById('manualSymbol').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveManualStock();
        }
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

function setupAutoRefresh() {
    clearInterval(autoRefreshInterval);
    
    const isAutoRefreshEnabled = localStorage.getItem('autoRefreshEnabled') === 'true';
    if (isAutoRefreshEnabled) {
        // Refresh prices every 60 seconds
        autoRefreshInterval = setInterval(() => {
            loadCurrentPrices();
            filterStocksNearSupport();
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
            showLoading(false);
            return currentPrices;
        } else {
            // If no stored prices, fallback to API for backward compatibility
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
        
        // Update current prices
        currentPrices = prices;
        
        // Store in localStorage for other pages
        localStorage.setItem('currentPrices', JSON.stringify(prices));
        
        showLoading(false);
        return prices;
    } catch (error) {
        console.error('Error fetching current prices:', error);
        showError('Failed to fetch current prices');
        showLoading(false);
        return {};
    }
}

function filterStocksNearSupport() {
    const useSupport1 = document.getElementById('filterSupport1').checked;
    const useSupport2 = document.getElementById('filterSupport2').checked;
    const useSupport3 = document.getElementById('filterSupport3').checked;
    
    const now = new Date();
    supportStocks = [];
    
    userStocks.forEach(stock => {
        const currentPrice = currentPrices[stock.symbol] || 0;
        if (currentPrice <= 0) return;
        
        // Check each support price if enabled
        if (useSupport1 && isNearSupport(currentPrice, stock.supportPrice1)) {
            // Check if this stock is newly near support
            const isNew = isNewNearSupport(stock.symbol, 'support1');
            
            supportStocks.push({
                symbol: stock.symbol,
                ltp: currentPrice,
                supportPrice: stock.supportPrice1,
                buyPrice: stock.supportPrice1,
                selected: true,
                isBought: isBoughtStock(stock.symbol),
                isNew: isNew
            });
        }
        
        if (useSupport2 && isNearSupport(currentPrice, stock.supportPrice2)) {
            // Check if this stock is already in supportStocks with support1
            const existingIndex = supportStocks.findIndex(s => s.symbol === stock.symbol);
            if (existingIndex === -1) {
                // Check if this stock is newly near support
                const isNew = isNewNearSupport(stock.symbol, 'support2');
                
                supportStocks.push({
                    symbol: stock.symbol,
                    ltp: currentPrice,
                    supportPrice: stock.supportPrice2,
                    buyPrice: stock.supportPrice2,
                    selected: true,
                    isBought: isBoughtStock(stock.symbol),
                    isNew: isNew
                });
            }
        }
        
        if (useSupport3 && isNearSupport(currentPrice, stock.supportPrice3)) {
            // Check if this stock is already in supportStocks with support1 or support2
            const existingIndex = supportStocks.findIndex(s => s.symbol === stock.symbol);
            if (existingIndex === -1) {
                // Check if this stock is newly near support
                const isNew = isNewNearSupport(stock.symbol, 'support3');
                
                supportStocks.push({
                    symbol: stock.symbol,
                    ltp: currentPrice,
                    supportPrice: stock.supportPrice3,
                    buyPrice: stock.supportPrice3,
                    selected: true,
                    isBought: isBoughtStock(stock.symbol),
                    isNew: isNew
                });
            }
        }
    });
    
    // Sort by proximity to support price
    supportStocks.sort((a, b) => {
        const diffA = calculateDifference(a.ltp, a.supportPrice);
        const diffB = calculateDifference(b.ltp, b.supportPrice);
        return diffA - diffB;
    });
    
    // Display the filtered stocks
    displaySupportStocks();
}

function isNewNearSupport(symbol, supportType) {
    const now = new Date();
    const key = `${symbol}_${supportType}`;
    
    if (!supportStocksHistory[key]) {
        // First time seeing this stock near this support level
        supportStocksHistory[key] = now.toISOString();
        localStorage.setItem('supportStocksHistory', JSON.stringify(supportStocksHistory));
        return true;
    } else {
        // Check if it's been less than NEW_BADGE_DAYS since this stock was first seen near support
        const firstSeen = new Date(supportStocksHistory[key]);
        const diffTime = Math.abs(now - firstSeen);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= NEW_BADGE_DAYS;
    }
}

function isBoughtStock(symbol) {
    return boughtStocks.some(stock => stock.symbol === symbol);
}

function isNearSupport(currentPrice, supportPrice) {
    if (!supportPrice || supportPrice <= 0) return false;
    
    const minFilterPercent = parseFloat(document.getElementById('filterMinPercentage').value) || DEFAULT_MIN_FILTER_PERCENTAGE;
    const maxFilterPercent = parseFloat(document.getElementById('filterMaxPercentage').value) || DEFAULT_MAX_FILTER_PERCENTAGE;
    const difference = calculateDifference(currentPrice, supportPrice);
    return difference >= minFilterPercent && difference <= maxFilterPercent;
}

function calculateDifference(current, support) {
    if (!support || support <= 0) return 0;
    return parseFloat(((current - support) / support * 100).toFixed(2));
}

function displaySupportStocks() {
    const tableBody = document.querySelector('#supportStockTable tbody');
    tableBody.innerHTML = '';
    
    if (supportStocks.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" class="no-data">No stocks found near support price</td>
        `;
        tableBody.appendChild(row);
        return;
    }
    
    // Clean up old chart instances
    Object.keys(chartInstances).forEach(symbol => {
        if (chartInstances[symbol] && chartInstances[symbol].chart) {
            chartInstances[symbol].chart.remove();
            delete chartInstances[symbol];
        }
    });
    
    supportStocks.forEach((stock, index) => {
        const row = document.createElement('tr');
        // Add data-symbol to the row for easier selection
        row.setAttribute('data-symbol', stock.symbol);
        
        // Check if stock is in watchlist and add the class if it is
        const isWatchlisted = typeof window.isInWatchlist === 'function' ? 
            window.isInWatchlist(stock.symbol) : false;
        
        if (isWatchlisted) {
            row.classList.add('watchlist-item');
        }
        
        // Create badges HTML
        const badgesHtml = createBadgesHtml(stock);
        
        row.innerHTML = `
            <td class="select-cell">
                <input type="checkbox" class="stock-select" data-index="${index}" ${stock.selected ? 'checked' : ''}>
            </td>
            <td class="clickable-symbol" data-symbol="${stock.symbol}">
                ${stock.symbol}
                ${badgesHtml}
            </td>
            <td>${stock.ltp.toFixed(2)}</td>
            <td>${stock.supportPrice.toFixed(2)}</td>
            <td>
                <input type="number" class="buy-price-input" data-index="${index}" 
                       value="${stock.buyPrice.toFixed(2)}" step="0.01" min="0">
            </td>
            <td class="actions-cell">
                <button class="delete-btn" data-index="${index}">Delete</button>
                <button class="chart-btn" data-symbol="${stock.symbol}">Chart</button>
                ${!stock.isBought ? 
                    `<button class="mark-bought-btn" data-index="${index}">Mark Bought</button>` : 
                    `<button class="mark-unbought-btn" data-index="${index}">Mark Not Bought</button>`}
            </td>
            <td class="chart-cell">
                <div id="chart-container-${stock.symbol}" class="chart-container-small"></div>
            </td>
        `;
        
        tableBody.appendChild(row);
        
        // Add watchlist button to the actions cell
        const actionsCell = row.querySelector('.actions-cell');
        if (actionsCell) {
            // Create the watchlist button
            const watchlistBtn = document.createElement('button');
            watchlistBtn.className = isWatchlisted ? 'watchlist-btn active' : 'watchlist-btn';
            watchlistBtn.setAttribute('data-watchlist', stock.symbol);
            
            watchlistBtn.textContent = isWatchlisted ? '★' : '☆';
            watchlistBtn.title = isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist';
            
            // Add click event listener
            watchlistBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Direct implementation of toggling instead of using the toggleWatchlist function
                const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
                const stockIndex = userStocks.findIndex(s => s.symbol === stock.symbol);
                
                let isNowWatchlisted = false;
                
                if (stockIndex !== -1) {
                    // Toggle the watchlist status
                    userStocks[stockIndex].watchlist = !userStocks[stockIndex].watchlist;
                    isNowWatchlisted = userStocks[stockIndex].watchlist;
                } else {
                    // Add new stock to watchlist
                    const newStock = {
                        symbol: stock.symbol,
                        watchlist: true,
                        addedAt: new Date().toISOString(),
                        folder: 'all',
                        supportPrice1: null,
                        supportPrice2: null,
                        supportPrice3: null,
                        upperLimit: null
                    };
                    userStocks.push(newStock);
                    isNowWatchlisted = true;
                }
                
                // Save to localStorage
                localStorage.setItem('userStocks', JSON.stringify(userStocks));
                
                // Update button appearance
                this.classList.toggle('active', isNowWatchlisted);
                this.textContent = isNowWatchlisted ? '★' : '☆';
                this.title = isNowWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist';
                
                // Update row appearance
                row.classList.toggle('watchlist-item', isNowWatchlisted);
                
                // Show feedback
                showSuccess(isNowWatchlisted ? 
                    `${stock.symbol} added to watchlist` : 
                    `${stock.symbol} removed from watchlist`);
            });
            
            // Insert at the beginning of the actions cell
            actionsCell.insertBefore(watchlistBtn, actionsCell.firstChild);
        }
    });
    
    // Add event listeners
    document.querySelectorAll('.stock-select').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            supportStocks[index].selected = e.target.checked;
        });
    });
    
    document.querySelectorAll('.buy-price-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            supportStocks[index].buyPrice = parseFloat(e.target.value);
        });
        
        // Add enter key support for buy price inputs
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const index = parseInt(e.target.dataset.index);
                supportStocks[index].buyPrice = parseFloat(e.target.value);
                e.target.blur(); // Remove focus after enter
            }
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            supportStocks.splice(index, 1);
            displaySupportStocks();
        });
    });
    
    document.querySelectorAll('.chart-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const symbol = e.target.dataset.symbol;
            if (symbol) {
                showFullScreenChart(symbol);
            }
        });
    });
    
    document.querySelectorAll('.clickable-symbol').forEach(symbol => {
        symbol.addEventListener('click', (e) => {
            const symbolText = e.target.dataset.symbol;
            if (symbolText) {
                window.location.href = `dashboard.html#${symbolText}`;
            }
        });
    });
    
    // Mark bought/not bought buttons
    document.querySelectorAll('.mark-bought-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            markStockAsBought(index);
        });
    });
    
    document.querySelectorAll('.mark-unbought-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            markStockAsNotBought(index);
        });
    });
    
    // Initialize charts after rows are created
    setTimeout(() => {
        supportStocks.forEach(stock => {
            initializeStockChart(stock.symbol);
        });
    }, 100);
}

function createBadgesHtml(stock) {
    let badges = '';
    
    if (stock.isNew) {
        badges += '<span class="badge new-badge">New</span>';
    }
    
    if (stock.isBought) {
        badges += '<span class="badge bought-badge">Bought</span>';
    }
    
    return badges;
}

function markStockAsBought(index) {
    const stock = supportStocks[index];
    
    // Add to bought stocks if not already there
    if (!isBoughtStock(stock.symbol)) {
        const boughtStock = {
            symbol: stock.symbol,
            buyPrice: stock.buyPrice,
            buyDate: new Date().toISOString(),
            quantity: DEFAULT_QUANTITY
        };
        
        boughtStocks.push(boughtStock);
        localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
        
        // Update the stock in the support list
        stock.isBought = true;
        
        // Refresh the display
        displaySupportStocks();
        
        showSuccess(`${stock.symbol} marked as bought at ${stock.buyPrice}`);
    }
}

function markStockAsNotBought(index) {
    const stock = supportStocks[index];
    
    // Remove from bought stocks
    const boughtIndex = boughtStocks.findIndex(s => s.symbol === stock.symbol);
    if (boughtIndex !== -1) {
        boughtStocks.splice(boughtIndex, 1);
        localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
        
        // Update the stock in the support list
        stock.isBought = false;
        
        // Refresh the display
        displaySupportStocks();
        
        showSuccess(`${stock.symbol} marked as not bought`);
    }
}

function generateOrderCode() {
    const selectedStocks = supportStocks.filter(stock => stock.selected);
    
    if (selectedStocks.length === 0) {
        showError('No stocks selected for order generation');
        return;
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
    
    // Check if we should add to stoploss/bought stocks
    const addToStoploss = document.getElementById('addToStoplossCheck').checked;
    
    if (addToStoploss) {
        // Mark selected stocks as bought
        selectedStocks.forEach(stock => {
            // Only add to bought stocks if not already there
            if (!isBoughtStock(stock.symbol)) {
                const boughtStock = {
                    symbol: stock.symbol,
                    buyPrice: stock.buyPrice,
                    buyDate: new Date().toISOString(),
                    quantity: DEFAULT_QUANTITY
                };
                
                boughtStocks.push(boughtStock);
                
                // Update the stock in the support list
                const index = supportStocks.findIndex(s => s.symbol === stock.symbol);
                if (index !== -1) {
                    supportStocks[index].isBought = true;
                }
            }
        });
        
        // Save bought stocks to localStorage
        localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
        
        // Show success message
        showSuccess(`${selectedStocks.length} stocks added to order code and stoploss page`);
    } else {
        // Just show message about order code
        showSuccess(`${selectedStocks.length} stocks added to order code`);
    }
    
    // Refresh the display
    displaySupportStocks();
    
    // Show the code
    document.getElementById('generatedCode').textContent = code;
    document.getElementById('codeOutput').style.display = 'block';
}

function getOrderPlacerFunction() {
    // Get the function from tms order placer.txt
    // For simplicity, I'm hardcoding the function here, but in a real implementation
    // you might want to fetch it from the file dynamically
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
        }, 1000); // 1-second delay before pressing Enter
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

function copyToClipboard() {
    const codeElement = document.getElementById('generatedCode');
    const codeText = codeElement.textContent;
    
    navigator.clipboard.writeText(codeText)
        .then(() => {
            showSuccess('Code copied to clipboard!');
        })
        .catch(err => {
            showError('Failed to copy code');
            console.error('Copy failed:', err);
        });
}

function getDifferenceClass(difference) {
    if (difference < 0) return 'negative';
    if (difference < 1) return 'neutral';
    if (difference <= 2) return 'positive';
    return '';
}

function showError(message) {
    const messageContainer = document.getElementById('messageContainer');
    messageContainer.innerHTML = `<div class="error-message">${message}</div>`;
    setTimeout(() => {
        messageContainer.innerHTML = '';
    }, 5000);
}

function showSuccess(message) {
    const messageContainer = document.getElementById('messageContainer');
    messageContainer.innerHTML = `<div class="success-message">${message}</div>`;
    setTimeout(() => {
        messageContainer.innerHTML = '';
    }, 5000);
}

function showLoading(show) {
    document.getElementById('loadingIndicator').style.display = show ? 'flex' : 'none';
}

// Function to downsample data points - keeps visual accuracy while reducing points
function downsampleData(data, threshold = 500) {
    if (data.length <= threshold) return data;
    
    // Simple method: take every nth item
    const n = Math.ceil(data.length / threshold);
    return data.filter((_, i) => i % n === 0);
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
    
    // Get support price for this symbol from the supportStocks array
    const stockData = supportStocks.find(s => s.symbol === symbol);
    const supportPrice = stockData ? stockData.supportPrice : null;
    
    // Set up dimensions
    const width = chartContainer.clientWidth;
    const height = 200;
    const margin = {top: 20, right: 20, bottom: 30, left: 40};
    
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
    const stockData = supportStocks.find(s => s.symbol === symbol);
    const supportPrice = stockData ? stockData.supportPrice : null;
    
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
        
        // Add support price line
        if (supportPrice && !isNaN(supportPrice)) {
            svg.append("line")
                .attr("x1", margin.left)
                .attr("x2", width - margin.right)
                .attr("y1", y(supportPrice))
                .attr("y2", y(supportPrice))
                .attr("stroke", "#1976D2")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "5,5");
            
            // Add support price label
            svg.append("text")
                .attr("x", width - margin.right + 5)
                .attr("y", y(supportPrice) + 4)
                .attr("fill", "#1976D2")
                .attr("font-size", "12px")
                .attr("text-anchor", "start")
                .text(`Support: ${supportPrice}`);
        }
        
        // Store reference to destroy on close
        popupContainer.chart = svg.node();
    }, 100);
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
        
        // Process the data
        processHistoricalData(data);
        
        showLoading(false);
    } catch (error) {
        console.error('Error fetching historical data:', error);
        showError('Failed to load historical price data: ' + error.message);
        showLoading(false);
    }
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
            close: parseFloat(item.close)
        });
    });
}

// Function to show the manual stock entry form
function showManualStockForm() {
    document.getElementById('manualStockForm').style.display = 'block';
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
    
    // Check which support prices to use based on filter settings
    const useSupport1 = document.getElementById('filterSupport1').checked;
    const useSupport2 = document.getElementById('filterSupport2').checked;
    const useSupport3 = document.getElementById('filterSupport3').checked;
    
    let supportPrice = 0;
    let supportType = '';
    
    // Try to find the best support price based on current filters and proximity to current price
    if (useSupport1 && isNearSupport(currentPrice, stockFromDashboard.supportPrice1)) {
        supportPrice = stockFromDashboard.supportPrice1;
        supportType = 'support1';
    } else if (useSupport2 && isNearSupport(currentPrice, stockFromDashboard.supportPrice2)) {
        supportPrice = stockFromDashboard.supportPrice2;
        supportType = 'support2';
    } else if (useSupport3 && isNearSupport(currentPrice, stockFromDashboard.supportPrice3)) {
        supportPrice = stockFromDashboard.supportPrice3;
        supportType = 'support3';
    } else {
        // If no support price is near, use the closest one
        const diffs = [
            { price: stockFromDashboard.supportPrice1, type: 'support1', diff: Math.abs(currentPrice - stockFromDashboard.supportPrice1) },
            { price: stockFromDashboard.supportPrice2, type: 'support2', diff: Math.abs(currentPrice - stockFromDashboard.supportPrice2) },
            { price: stockFromDashboard.supportPrice3, type: 'support3', diff: Math.abs(currentPrice - stockFromDashboard.supportPrice3) }
        ].filter(item => item.price > 0);
        
        if (diffs.length > 0) {
            diffs.sort((a, b) => a.diff - b.diff);
            supportPrice = diffs[0].price;
            supportType = diffs[0].type;
        } else {
            showError(`No support prices defined for ${symbol} in your dashboard.`);
            return;
        }
    }
    
    // Check if this stock is already in supportStocks
    const existingIndex = supportStocks.findIndex(s => s.symbol === symbol);
    if (existingIndex !== -1) {
        // Update existing entry
        supportStocks[existingIndex].ltp = currentPrice;
        supportStocks[existingIndex].supportPrice = supportPrice;
        supportStocks[existingIndex].buyPrice = supportPrice;
        showSuccess(`Updated ${symbol} in support stocks list`);
    } else {
        // Create new entry
        supportStocks.push({
            symbol: symbol,
            ltp: currentPrice,
            supportPrice: supportPrice,
            buyPrice: supportPrice,
            selected: true,
            isBought: isBoughtStock(symbol),
            isNew: true
        });
        
        // Add to supportStocksHistory to track as new
        const key = `${symbol}_${supportType}`;
        supportStocksHistory[key] = new Date().toISOString();
        localStorage.setItem('supportStocksHistory', JSON.stringify(supportStocksHistory));
        showSuccess(`${symbol} added to support stocks list`);
    }
    
    // Hide the form
    hideManualStockForm();
    
    // Update the display
    displaySupportStocks();
}

// Load saved filter settings from localStorage
function loadSavedFilterSettings() {
    // Use the existing loadFilterSettings function
    loadFilterSettings();
}

// Load saved filter settings from localStorage
function loadFilterSettings() {
    const minPercentage = localStorage.getItem('filterMinPercentage');
    const maxPercentage = localStorage.getItem('filterMaxPercentage');
    
    if (minPercentage !== null) {
        document.getElementById('filterMinPercentage').value = minPercentage;
    }
    
    if (maxPercentage !== null) {
        document.getElementById('filterMaxPercentage').value = maxPercentage;
    }
}

// Save filter settings to localStorage
function saveFilterSettings() {
    const minPercentage = document.getElementById('filterMinPercentage').value;
    const maxPercentage = document.getElementById('filterMaxPercentage').value;
    
    localStorage.setItem('filterMinPercentage', minPercentage);
    localStorage.setItem('filterMaxPercentage', maxPercentage);
}

// Add toggleWatchlist function to use the common version
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

// Add styles for watchlist items if not already present
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
