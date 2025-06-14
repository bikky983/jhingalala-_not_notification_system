document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const loadingIndicator = document.getElementById('loadingIndicator');
    const weekSelector = document.getElementById('weekSelector');
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const volumeViewBtn = document.getElementById('volumeViewBtn');
    const changeViewBtn = document.getElementById('changeViewBtn');
    const percentViewBtn = document.getElementById('percentViewBtn');
    const getStocksBtn = document.getElementById('getStocksBtn');
    const dashboardStocksOnlyCheckbox = document.getElementById('dashboardStocksOnlyCheckbox');
    const minThresholdSlider = document.getElementById('minThreshold');
    const maxThresholdSlider = document.getElementById('maxThreshold');
    const minThresholdValueDisplay = document.getElementById('minThresholdValue');
    const maxThresholdValueDisplay = document.getElementById('maxThresholdValue');
    
    // State variables
    let stockData = [];
    let weeklyData = {};
    let currentDateRange = {
        startDate: null,
        endDate: null
    };
    let currentView = 'volume'; // 'volume', 'change', 'percent'
    let dashboardStocksOnly = false;
    let dashboardStocks = [];
    let stockSectors = {};
    let stockHistoricalData = {}; // Store historical data for charts
    let minSupportThreshold = -3; // Default min threshold percentage
    let maxSupportThreshold = 4; // Default max threshold percentage
    let analysisDays = 7; // Default number of days for analysis
    
    // Initialize event listeners
    initEventListeners();
    
    // Set Dashboard Stocks Only checkbox to checked by default
    if (localStorage.getItem('heatmapDashboardStocksOnly') === 'false') {
        dashboardStocksOnlyCheckbox.checked = false;
        dashboardStocksOnly = false;
    } else {
        // Default is true or if setting doesn't exist
        dashboardStocksOnlyCheckbox.checked = true;
        dashboardStocksOnly = true;
        localStorage.setItem('heatmapDashboardStocksOnly', 'true');
    }
    
    // Load saved analysis days setting
    const savedDays = localStorage.getItem('analysisDays');
    if (savedDays) {
        analysisDays = parseInt(savedDays);
        const daysSelector = document.getElementById('daysSelector');
        if (daysSelector) {
            daysSelector.value = analysisDays;
        }
    }
    
    // Load data on page load
    loadDashboardData();
    
    // First load historical data, then load and process the main data
    fetchHistoricalData().then(() => {
        loadData();
    });
    
    // Get Stocks button functionality
    if (getStocksBtn) {
        getStocksBtn.addEventListener('click', function() {
            // Create a link to download the stocks.xlsx file
            const downloadLink = document.createElement('a');
            downloadLink.href = 'stocks.xlsx';
            downloadLink.download = 'stocks.xlsx';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        });
    }
    
    // Functions
    function initEventListeners() {
        // Keep the Apply button functionality as an option to select a specific week
        applyFilterBtn.addEventListener('click', function() {
            const selectedWeek = weekSelector.value;
            if (selectedWeek) {
                const [year, week] = selectedWeek.split('-W');
                const weekNumber = parseInt(week);
                const dates = getSundayToSaturdayDatesForWeek(parseInt(year), weekNumber);
                currentDateRange = dates;
                processWeeklyData();
                updateVisualizations();
                // Update date range display
                updateDateRangeDisplay();
            }
        });
        
        // Apply days button functionality
        const applyDaysBtn = document.getElementById('applyDaysBtn');
        if (applyDaysBtn) {
            applyDaysBtn.addEventListener('click', function() {
                const daysSelector = document.getElementById('daysSelector');
                if (daysSelector) {
                    const newDays = parseInt(daysSelector.value);
                    if (newDays >= 1) {
                        analysisDays = newDays;
                        // Save to localStorage
                        localStorage.setItem('analysisDays', String(analysisDays));
                        // Update the date range and refresh data
                        setLastCustomDays();
                        processWeeklyData();
                        updateVisualizations();
                        updateDateRangeDisplay();
                        console.log(`Analysis days updated to ${analysisDays}`);
                    }
                }
            });
        }
        
        volumeViewBtn.addEventListener('click', function() {
            setActiveView('volume');
        });
        
        changeViewBtn.addEventListener('click', function() {
            setActiveView('change');
        });
        
        percentViewBtn.addEventListener('click', function() {
            setActiveView('percent');
        });
        
        dashboardStocksOnlyCheckbox.addEventListener('change', function() {
            dashboardStocksOnly = this.checked;
            localStorage.setItem('heatmapDashboardStocksOnly', String(dashboardStocksOnly));
            processWeeklyData();
            updateVisualizations();
        });
        
        // Add support threshold slider event listener
        if (minThresholdSlider) {
            minThresholdSlider.addEventListener('input', function() {
                minSupportThreshold = parseFloat(this.value);
                if (minThresholdValueDisplay) {
                    minThresholdValueDisplay.textContent = minSupportThreshold;
                }
                // Re-process data to update support level highlighting
                processWeeklyData();
                updateVisualizations();
            });
        }
        
        if (maxThresholdSlider) {
            maxThresholdSlider.addEventListener('input', function() {
                maxSupportThreshold = parseFloat(this.value);
                if (maxThresholdValueDisplay) {
                    maxThresholdValueDisplay.textContent = maxSupportThreshold;
                }
                // Re-process data to update support level highlighting
                processWeeklyData();
                updateVisualizations();
            });
        }
    }
    
    function setActiveView(view) {
        currentView = view;
        
        // Update UI active state
        volumeViewBtn.classList.toggle('active', view === 'volume');
        changeViewBtn.classList.toggle('active', view === 'change');
        percentViewBtn.classList.toggle('active', view === 'percent');
        
        // Update visualizations with new view
        updateVisualizations();
    }
    
    function loadDashboardData() {
        try {
            // Reset arrays
            dashboardStocks = [];
            stockSectors = {};
            
            // First try to get userStocks which contains folder information
            const userStocksData = localStorage.getItem('userStocks');
            if (userStocksData) {
                try {
                    const userStocks = JSON.parse(userStocksData);
                    if (Array.isArray(userStocks)) {
                        userStocks.forEach(stock => {
                            if (stock && stock.symbol) {
                                const symbol = stock.symbol;
                                if (!dashboardStocks.includes(symbol)) {
                                    dashboardStocks.push(symbol);
                                }
                                // Store folder/sector if available
                                if (stock.folder) {
                                    stockSectors[symbol] = stock.folder;
                                    console.log(`Assigned sector ${stock.folder} to ${symbol} from userStocks`);
                                }
                            }
                        });
                        console.log(`Loaded ${dashboardStocks.length} stocks from userStocks`);
                    }
                } catch (e) {
                    console.error('Error parsing userStocks data:', e);
                }
            }
            
            // Try folders data as a fallback
            const foldersData = localStorage.getItem('folders');
            if (foldersData) {
                try {
                    const folders = JSON.parse(foldersData);
                    if (Array.isArray(folders)) {
                        folders.forEach(folder => {
                            if (typeof folder === 'string' && folder.toLowerCase() !== 'all') {
                                const folderStocksKey = `folder_${folder}`;
                                const folderStocksData = localStorage.getItem(folderStocksKey);
                                
                                if (folderStocksData) {
                                    try {
                                        const folderStocks = JSON.parse(folderStocksData);
                                        if (Array.isArray(folderStocks)) {
                                            folderStocks.forEach(stock => {
                                                if (typeof stock === 'string') {
                                                    if (!dashboardStocks.includes(stock)) {
                                                        dashboardStocks.push(stock);
                                                    }
                                                    // Assign sector if not already set
                                                    if (!stockSectors[stock]) {
                                                        stockSectors[stock] = folder;
                                                        console.log(`Assigned sector ${folder} to ${stock} from folders`);
                                                    }
                                                }
                                            });
                                        }
                                    } catch (e) {
                                        console.error(`Error parsing folder stocks for ${folder}:`, e);
                                    }
                                }
                            }
                        });
                    }
                    console.log(`After folder scan: ${Object.keys(stockSectors).length} stocks with sectors`);
                } catch (e) {
                    console.error('Error parsing folders data:', e);
                }
            }
            
            // Also check watchlistData for any additional stocks
            const watchlistData = localStorage.getItem('watchlistData');
            if (watchlistData) {
                try {
                    const parsedData = JSON.parse(watchlistData);
                    Object.entries(parsedData).forEach(([symbol, data]) => {
                        if (!dashboardStocks.includes(symbol)) {
                            dashboardStocks.push(symbol);
                        }
                        
                        // Assign folder/sector if available and not already set
                        if (data.folder && !stockSectors[symbol]) {
                            stockSectors[symbol] = data.folder;
                            console.log(`Assigned sector ${data.folder} to ${symbol} from watchlist`);
                        }
                    });
                    console.log(`After watchlist scan: ${dashboardStocks.length} total stocks`);
                } catch (e) {
                    console.error('Error parsing watchlist data:', e);
                }
            }
            
            // Final check for stocks without sectors
            dashboardStocks.forEach(symbol => {
                if (!stockSectors[symbol]) {
                    // Try to determine sector based on naming conventions
                    if (symbol.endsWith('LBL') || symbol.endsWith('MFI') || symbol.includes('MICRO')) {
                        stockSectors[symbol] = 'MICROFINANCE';
                    } else if (symbol.endsWith('HPC') || symbol.includes('HYDRO')) {
                        stockSectors[symbol] = 'HYDROPOWER';
                    } else if (symbol.endsWith('LIC') || symbol.includes('INSURANCE')) {
                        stockSectors[symbol] = 'INSURANCE';
                    } else if (symbol.endsWith('BNK') || symbol.includes('BANK')) {
                        stockSectors[symbol] = 'BANKING';
                    } else if (symbol.endsWith('FIN') || symbol.includes('FINANCE')) {
                        stockSectors[symbol] = 'FINANCE';
                    } else if (symbol.endsWith('DEV') || symbol.includes('DEVELOPMENT')) {
                        stockSectors[symbol] = 'DEVELOPMENT_BANK';
                    } else if (symbol.endsWith('MFG') || symbol.includes('MANUFACTURING')) {
                        stockSectors[symbol] = 'MANUFACTURING';
                    } else {
                        stockSectors[symbol] = 'OTHER';
                    }
                    console.log(`Assigned sector ${stockSectors[symbol]} to ${symbol} based on pattern`);
                }
            });
            
            console.log(`Final count: ${dashboardStocks.length} stocks with ${Object.keys(stockSectors).length} having sector information`);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }
    
    async function loadData() {
        try {
            showLoading(true);
            
            // Use the existing file directly - don't use the apiService
            // since we're not modifying the original apiService.js
            const response = await fetch('organized_nepse_data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            stockData = await response.json();
            
            // Set the date range to the custom number of days
            setLastCustomDays();
            
            // Initialize the week selector with the current week
            const today = new Date();
            const currentYear = today.getFullYear();
            let currentWeekNum = getWeekNumber(today);
            weekSelector.value = `${currentYear}-W${currentWeekNum.toString().padStart(2, '0')}`;
            
            // Process data for the selected week
            processWeeklyData();
            updateVisualizations();
            // Update date range display
            updateDateRangeDisplay();
            
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            showLoading(false);
        }
    }
    
    function setLastCustomDays() {
        const endDate = new Date(); // Today
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - (analysisDays - 1)); // Days ago (to make total days including today)
        
        // Set start date to beginning of day
        startDate.setHours(0, 0, 0, 0);
        
        // Set end date to end of day
        endDate.setHours(23, 59, 59, 999);
        
        currentDateRange = { startDate, endDate };
        
        console.log(`Date range set to: ${startDate.toDateString()} - ${endDate.toDateString()} (${analysisDays} days)`);
    }
    
    // For backward compatibility
    function setLastSevenDays() {
        setLastCustomDays();
    }
    
    function updateDateRangeDisplay() {
        // Create or update a display element to show the current date range
        let dateRangeDisplay = document.getElementById('dateRangeDisplay');
        
        if (!dateRangeDisplay) {
            dateRangeDisplay = document.createElement('div');
            dateRangeDisplay.id = 'dateRangeDisplay';
            dateRangeDisplay.className = 'date-range-display';
            
            // Insert after the filters container
            const filtersContainer = document.querySelector('.filters-container');
            filtersContainer.parentNode.insertBefore(dateRangeDisplay, filtersContainer.nextSibling);
        }
        
        // Format the dates
        const startDateStr = currentDateRange.startDate.toLocaleDateString('en-US', { 
            year: 'numeric', month: 'short', day: 'numeric' 
        });
        const endDateStr = currentDateRange.endDate.toLocaleDateString('en-US', { 
            year: 'numeric', month: 'short', day: 'numeric' 
        });
        
        // Calculate number of days
        const dayDiff = Math.floor((currentDateRange.endDate - currentDateRange.startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        // Update the content
        dateRangeDisplay.innerHTML = `
            <div class="date-range-info">
                <h3>Current Analysis Period (${dayDiff} Days)</h3>
                <p>${startDateStr} to ${endDateStr}</p>
            </div>
        `;
    }
    
    function processWeeklyData() {
        if (!currentDateRange.startDate || !currentDateRange.endDate || !stockData.length) return;
        
        // Group data by stock symbol and extract weekly information
        const stockGroups = {};
        
        stockData.forEach(record => {
            // Skip if we're filtering to dashboard stocks only and this isn't in the dashboard
            if (dashboardStocksOnly && !dashboardStocks.includes(record.symbol)) {
                return;
            }
            
            const recordDate = new Date(record.time.replace(/_/g, '-'));
            
            // Check if record date falls within our date range
            if (isDateInRange(recordDate, currentDateRange.startDate, currentDateRange.endDate)) {
                if (!stockGroups[record.symbol]) {
                    stockGroups[record.symbol] = [];
                }
                
                stockGroups[record.symbol].push(record);
            }
        });
        
        // Calculate weekly metrics for each stock
        weeklyData = {};
        
        Object.keys(stockGroups).forEach(symbol => {
            const records = stockGroups[symbol];
            
            if (records.length > 0) {
                // Sort by date
                records.sort((a, b) => {
                    return new Date(a.time.replace(/_/g, '-')) - new Date(b.time.replace(/_/g, '-'));
                });
                
                // Handle potential missing data due to holidays
                const firstRecord = records[0];
                const lastRecord = records[records.length - 1];
                
                // Calculate weekly metrics
                const weeklyOpen = firstRecord.open;
                const weeklyClose = lastRecord.close;
                const priceChange = weeklyClose - weeklyOpen;
                const percentChange = (priceChange / weeklyOpen) * 100;
                
                // Calculate weekly high/low
                let weeklyHigh = -Infinity;
                let weeklyLow = Infinity;
                
                records.forEach(record => {
                    weeklyHigh = Math.max(weeklyHigh, record.high);
                    weeklyLow = Math.min(weeklyLow, record.low);
                });
                
                // Calculate volatility (high-low range as percentage of open)
                const volatility = ((weeklyHigh - weeklyLow) / weeklyOpen) * 100;
                
                // Get total volume using the same method as IPO rights page
                const totalVolume = calculateTotalVolume(symbol);
                
                // Calculate average daily volume
                const avgDailyVolume = totalVolume / analysisDays; // Using custom days as the period
                
                // Count trading days in the period
                const tradingDays = records.length;
                
                // Calculate missing days (holidays)
                const totalDaysInPeriod = analysisDays; // Last X days
                const holidayDays = totalDaysInPeriod - tradingDays;
                
                // Calculate simple RSI based on weekly data
                const rsi = calculateSimpleRSI(records);
                
                weeklyData[symbol] = {
                    symbol,
                    open: weeklyOpen,
                    close: weeklyClose,
                    high: weeklyHigh,
                    low: weeklyLow,
                    priceChange,
                    percentChange,
                    volume: totalVolume,
                    avgDailyVolume,
                    volatility,
                    tradingDays,
                    holidayDays,
                    rsi,
                    dailyRecords: records
                };
            }
        });
    }
    
    function calculateSimpleRSI(records) {
        if (records.length < 2) return 50; // Neutral RSI if not enough data
        
        let gains = 0;
        let losses = 0;
        
        // Calculate gains and losses
        for (let i = 1; i < records.length; i++) {
            const change = records[i].close - records[i-1].close;
            if (change >= 0) {
                gains += change;
            } else {
                losses -= change; // Make losses positive
            }
        }
        
        // Average gains and losses
        const avgGain = gains / (records.length - 1);
        const avgLoss = losses / (records.length - 1);
        
        // Calculate RSI
        if (avgLoss === 0) return 100; // All gains
        
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        
        return rsi;
    }
    
    function updateVisualizations() {
        if (Object.keys(weeklyData).length === 0) return;
        
        // Convert weeklyData object to array for sorting
        const dataArray = Object.values(weeklyData);
        
        // Update the detailed table
        updateDetailedTable(dataArray);
        
        // Update heatmaps based on current view
        updateHeatmaps(dataArray);
        
        // Create tree visualization
        createTreemap(dataArray);
    }
    
    function updateDetailedTable(dataArray) {
        const tableBody = document.querySelector('#stockPerformanceTable tbody');
        tableBody.innerHTML = '';
        
        // Sort by volume (descending)
        dataArray.sort((a, b) => b.volume - a.volume);
        
        dataArray.forEach(stock => {
            const row = document.createElement('tr');
            
            // Determine CSS classes based on values
            const changeClass = stock.percentChange > 0 ? 'positive' : 
                               stock.percentChange < 0 ? 'negative' : 'neutral';
            
            const volumeClass = isHighVolume(stock.volume, dataArray) ? 'high-volume' : '';
            const volatilityClass = stock.volatility > 10 ? 'high-volatility' : 
                                   stock.volatility < 3 ? 'low-volatility' : '';
            
            const holidayInfo = stock.holidayDays > 0 ? 
                               `<span class="holiday-indicator">(${stock.holidayDays} holiday${stock.holidayDays > 1 ? 's' : ''})</span>` : '';
            
            let rsiClass = '';
            if (stock.rsi > 70) rsiClass = 'high-volatility';
            else if (stock.rsi < 30) rsiClass = 'low-volatility';
            
            row.innerHTML = `
                <td>${stock.symbol}</td>
                <td>${stock.open.toFixed(2)}</td>
                <td>${stock.close.toFixed(2)}</td>
                <td class="${changeClass}">${stock.percentChange.toFixed(2)}%</td>
                <td class="${volumeClass}">${formatNumber(stock.volume)} ${holidayInfo}</td>
                <td>${stock.high.toFixed(2)}</td>
                <td>${stock.low.toFixed(2)}</td>
                <td class="${volatilityClass}">${stock.volatility.toFixed(2)}%</td>
                <td class="${rsiClass}">${stock.rsi.toFixed(1)}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    function updateHeatmaps(dataArray) {
        // Clear previous visualizations
        document.getElementById('gainersHeatmap').innerHTML = '';
        document.getElementById('losersHeatmap').innerHTML = '';
        document.getElementById('volumeHeatmap').innerHTML = '';
        document.getElementById('momentumHeatmap').innerHTML = '';
        
        // Top gainers (highest percent change)
        const gainers = [...dataArray]
            .filter(stock => stock.percentChange > 0)
            .sort((a, b) => b.percentChange - a.percentChange)
            .slice(0, 15);
            
        // Top losers (lowest percent change)
        const losers = [...dataArray]
            .filter(stock => stock.percentChange < 0)
            .sort((a, b) => a.percentChange - b.percentChange)
            .slice(0, 15);
            
        // Highest volume
        const highestVolume = [...dataArray]
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 15);
            
        // Momentum leaders (high RSI and volume)
        const momentumLeaders = [...dataArray]
            .filter(stock => stock.rsi > 50 && stock.percentChange > 0)
            .sort((a, b) => (b.rsi + b.percentChange) - (a.rsi + a.percentChange))
            .slice(0, 15);
        
        // Create heatmaps
        createHeatmap('gainersHeatmap', gainers, currentView);
        createHeatmap('losersHeatmap', losers, currentView);
        createHeatmap('volumeHeatmap', highestVolume, currentView);
        createHeatmap('momentumHeatmap', momentumLeaders, currentView);
    }
    
    function createHeatmap(containerId, data, viewType) {
        const container = document.getElementById(containerId);
        
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="no-data">No data available</div>';
            return;
        }
        
        // Determine value and color scale based on view type
        let valueAccessor, colorScale, format;
        
        if (viewType === 'volume') {
            valueAccessor = d => d.volume;
            colorScale = d3.scaleSequential(d3.interpolateBlues)
                .domain([0, d3.max(data, d => d.volume)]);
            format = formatNumber;
        } else if (viewType === 'change') {
            valueAccessor = d => d.priceChange;
            colorScale = d3.scaleSequential()
                .domain([d3.min(data, d => d.priceChange), d3.max(data, d => d.priceChange)])
                .interpolator(d => {
                    return d < 0 ? d3.interpolateReds(Math.abs(d) / Math.abs(d3.min(data, d => d.priceChange))) : d3.interpolateGreens(d / d3.max(data, d => Math.max(0, d.priceChange)));
                });
            format = d => d.toFixed(2);
        } else { // percent
            valueAccessor = d => d.percentChange;
            colorScale = d3.scaleSequential()
                .domain([d3.min(data, d => d.percentChange), d3.max(data, d => d.percentChange)])
                .interpolator(d => {
                    return d < 0 ? d3.interpolateReds(Math.abs(d) / Math.abs(d3.min(data, d => d.percentChange))) : d3.interpolateGreens(d / d3.max(data, d => Math.max(0, d.percentChange)));
                });
            format = d => d.toFixed(2) + '%';
        }
        
        // Set up dimensions
        const margin = { top: 20, right: 20, bottom: 30, left: 60 };
        const width = container.clientWidth - margin.left - margin.right;
        const height = 280 - margin.top - margin.bottom;
        
        // Create the SVG container
        const svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        // Set up scales
        const x = d3.scaleBand()
            .domain(data.map(d => d.symbol))
            .range([0, width])
            .padding(0.1);
        
        // Determine y-scale domain based on data values
        // For negative values (e.g., in losers chart), we need to include negatives in the domain
        const minValue = d3.min(data, valueAccessor);
        const maxValue = d3.max(data, valueAccessor);
        const yDomain = [
            Math.min(0, minValue), // Use 0 or the minimum value if it's negative
            Math.max(0, maxValue)  // Use 0 or the maximum value if it's positive
        ];
        
        const y = d3.scaleLinear()
            .domain(yDomain)
            .range([height, 0])
            .nice(); // Add nice() to round the domain to nice values
        
        // Add a zero line if domain includes negative values
        if (minValue < 0) {
            svg.append('line')
                .attr('x1', 0)
                .attr('y1', y(0))
                .attr('x2', width)
                .attr('y2', y(0))
                .attr('stroke', '#888')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '4');
        }
        
        // Create the bars
        svg.selectAll('.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.symbol))
            .attr('width', x.bandwidth())
            .attr('y', d => valueAccessor(d) < 0 ? y(0) : y(valueAccessor(d)))
            .attr('height', d => Math.abs(y(valueAccessor(d)) - y(0)))
            .attr('fill', d => colorScale(valueAccessor(d)));
        
        // Add value labels
        svg.selectAll('.label')
            .data(data)
            .enter()
            .append('text')
            .attr('class', 'label')
            .attr('x', d => x(d.symbol) + x.bandwidth() / 2)
            .attr('y', d => valueAccessor(d) < 0 ? y(valueAccessor(d)) + 15 : y(valueAccessor(d)) - 5)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#333')
            .text(d => format(valueAccessor(d)));
        
        // Add the x-axis
        svg.append('g')
            .attr('transform', `translate(0,${y(0)})`) // Position at y(0) instead of height
            .call(d3.axisBottom(x))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em');
        
        // Add the y-axis
        svg.append('g')
            .call(d3.axisLeft(y));
    }
    
    function createTreemap(dataArray) {
        const container = document.getElementById('treeMapContainer');
        container.innerHTML = '';
        
        if (!dataArray || dataArray.length === 0) {
            container.innerHTML = '<div class="no-data">No data available</div>';
            return;
        }
        
        // Group stocks by sector
        const sectors = {};
        
        dataArray.forEach(stock => {
            // Get sector from localStorage data or default to "OTHER"
            let sector = "OTHER";
            
            // Try to get sector from userStocks in localStorage
            try {
                const userStocksData = localStorage.getItem('userStocks');
                if (userStocksData) {
                    const userStocks = JSON.parse(userStocksData);
                    if (Array.isArray(userStocks)) {
                        // Find the stock entry by symbol
                        const stockInfo = userStocks.find(s => s && s.symbol === stock.symbol);
                        // Check if it has a folder property (sector)
                        if (stockInfo && stockInfo.folder) {
                            sector = stockInfo.folder;
                            console.log(`Found sector ${sector} for ${stock.symbol} in userStocks`);
                        }
                    }
                }
            } catch (e) {
                console.error(`Error getting sector for ${stock.symbol} from userStocks:`, e);
            }
            
            // If sector is still the default, try folders data
            if (sector === "OTHER") {
                try {
                    // Check each folder in localStorage
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith('folder_') && key !== 'folder_all') {
                            const folderName = key.replace('folder_', '');
                            const folderStocks = JSON.parse(localStorage.getItem(key));
                            if (Array.isArray(folderStocks) && folderStocks.includes(stock.symbol)) {
                                sector = folderName;
                                console.log(`Found sector ${sector} for ${stock.symbol} in folder data`);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Error checking folders for ${stock.symbol}:`, e);
                }
            }
            
            // Create sector group if it doesn't exist
            if (!sectors[sector]) {
                sectors[sector] = [];
            }
            
            // Add stock to its sector group
            sectors[sector].push({
                ...stock,
                sector: sector
            });
        });
        
        // Define sector colors for consistent visualization
        const sectorColors = {
            'BANKING': '#4CAF50',
            'MICROFINANCE': '#2196F3',
            'FINANCE': '#9C27B0',
            'DEVELOPMENT_BANK': '#FF9800',
            'HYDROPOWER': '#03A9F4',
            'INSURANCE': '#E91E63',
            'MANUFACTURING': '#795548',
            'OTHER': '#607D8B'
        };
        
        // Ensure all sectors have a color
        Object.keys(sectors).forEach(sector => {
            if (!sectorColors[sector]) {
                // Generate a consistent color for unknown sectors
                sectorColors[sector] = '#' + 
                    ((Math.abs(sector.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 0xFFFFFF) | 0x666666).toString(16).padStart(6, '0');
                console.log(`Generated color ${sectorColors[sector]} for sector ${sector}`);
            }
        });
        
        // Prepare data in hierarchical structure for treemap
        const treeData = {
            name: "Stocks",
            children: []
        };
        
        // Add sectors with their respective stocks
        Object.entries(sectors).forEach(([sector, stocks]) => {
            // Only add sectors that have stocks
            if (stocks.length > 0) {
                // Calculate volume statistics for this sector to normalize sizes within sector
                const sectorVolumes = stocks.map(stock => stock.volume);
                const maxSectorVolume = Math.max(...sectorVolumes);
                const minSectorVolume = Math.min(...sectorVolumes);
                const medianSectorVolume = sectorVolumes.sort((a, b) => a - b)[Math.floor(sectorVolumes.length / 2)];
                
                treeData.children.push({
                    name: sector,
                    color: sectorColors[sector],
                    children: stocks.map(stock => {
                        // Calculate a relative size factor within this sector
                        // This ensures even small volume stocks in small sectors get reasonable visibility
                        let relativeSizeFactor;
                        if (maxSectorVolume === minSectorVolume) {
                            relativeSizeFactor = 1; // All same size if all volumes are equal
                        } else {
                            // Create a relative size within sector that's more pronounced
                            relativeSizeFactor = 0.5 + ((stock.volume - minSectorVolume) / (maxSectorVolume - minSectorVolume)) * 1.5;
                        }
                        
                        return {
                            name: stock.symbol,
                            value: stock.volume,  // Original volume for the hierarchy calculation
                            relativeSizeFactor: relativeSizeFactor, // Store for potential custom sizing
                            sector: sector,
                            originalValue: stock.percentChange,
                            volume: stock.volume,
                            open: stock.open,
                            close: stock.close,
                            priceChange: stock.priceChange,
                            rsi: stock.rsi
                        };
                    })
                });
            }
        });
        
        // Set up dimensions
        const width = container.clientWidth;
        const height = 1200; // Increased from 800 to 1200 for much more vertical space
        
        // Create the SVG container with a border
        const svg = d3.select('#treeMapContainer')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('font-family', 'sans-serif')
            .style('border-radius', '6px')
            .style('overflow', 'hidden');
        
        // Create the treemap layout with improved sector and stock differentiation
        const treemap = d3.treemap()
            .size([width, height])
            .paddingTop(25)
            .paddingBottom(2)
            .paddingRight(2)
            .paddingLeft(2)
            // Increase inner padding to better distinguish between stocks
            .paddingInner(3)
            // Add tile method to improve the layout of cells within sectors
            .tile(d3.treemapBinary)
            .round(true);
        
        // Format the data for d3 hierarchy with custom sizing
        const root = d3.hierarchy(treeData)
            .sum(d => {
                // Use a more balanced approach to sizing
                if (d.value) {
                    // If we have a relativeSizeFactor (for stocks within sectors), use it
                    if (d.relativeSizeFactor !== undefined) {
                        // Base size on volume but adjusted by relative factor within sector
                        // This creates more noticeable but not extreme size differences
                        return Math.log(d.value + 1) * 100 * d.relativeSizeFactor;
                    } else {
                        // For sectors themselves, use standard logarithmic scaling
                        return Math.log(d.value + 1) * 150;
                    }
                }
                return 100; // Default size for non-leaf nodes
            })
            // Sort by value (volume) within each sector
            .sort((a, b) => {
                // If they're in the same sector, sort by value
                if (a.parent === b.parent) {
                    return b.value - a.value;
                }
                // Otherwise maintain sector grouping
                return b.parent.value - a.parent.value;
            });
        
        // Apply the treemap layout
        treemap(root);
        
        // Create a color scale based on percent change
        const colorScale = d3.scaleSequential()
            .domain([-10, 10])
            .interpolator(d => {
                if (d < 0) {
                    return d3.interpolateReds(Math.min(1, Math.abs(d) / 10));
                } else {
                    return d3.interpolateGreens(Math.min(1, d / 10));
                }
            });
        
        // Add sector background colors
        svg.selectAll('.sector-background')
            .data(root.children)
            .enter()
            .append('rect')
            .attr('class', 'sector-background')
            .attr('x', d => d.x0)
            .attr('y', d => d.y0)
            .attr('width', d => d.x1 - d.x0)
            .attr('height', d => d.y1 - d.y0)
            .attr('fill', d => d.data.color ? `${d.data.color}33` : '#f5f5f5') // Add 33 (20% opacity) to hex color
            .attr('stroke', d => d.data.color || '#ddd')
            .attr('stroke-width', 1);
        
        // Add parent group labels (the categories/sectors) - more compact
        svg.selectAll('.parent')
            .data(root.children)
            .enter()
            .append('text')
            .attr('class', 'treemap-parent-label')
            .attr('x', d => d.x0 + 5) // Reduced from 8 to 5
            .attr('y', d => d.y0 + 15) // Reduced from 20 to 15
            .text(d => `${d.data.name} (${d.leaves().length})`)
            .attr('font-size', '12px') // Reduced from 16px to 12px
            .attr('font-weight', 'bold')
            .attr('fill', '#333');
        
        // Create the treemap cells
        const cell = svg.selectAll('.cell')
            .data(root.leaves())
            .enter()
            .append('g')
            .attr('class', 'treemap-cell')
            .attr('transform', d => `translate(${d.x0},${d.y0})`);
        
        // Add rectangles for each cell
        cell.append('rect')
            .attr('width', d => Math.max(0, d.x1 - d.x0))
            .attr('height', d => Math.max(0, d.y1 - d.y0))
            .attr('fill', d => {
                // Check which support level the stock is near
                const supportLevel = isNearSupportLevel(d.data.name, d.data.close);
                if (supportLevel > 0) {
                    // Different colors based on support level - using lighter variants
                    switch (supportLevel) {
                        case 1: return '#90CAF9'; // Even lighter blue for Support 1
                        case 2: return '#FFCC80'; // Even lighter orange for Support 2
                        case 3: return '#BCAAA4'; // Even lighter brown for Support 3
                        default: return colorScale(d.data.originalValue); 
                    }
                } else {
                    // Original color based on value
                    return colorScale(d.data.originalValue);
                }
            })
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .attr('class', 'treemap-cell')
            .style('cursor', 'pointer') // Show pointer cursor on hover
            .on('mouseover', function(event, d) {
                // Add hover effect
                d3.select(this)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 2);
                    
                // Get any additional support price info from userStocks
                let supportPrice1 = null;
                let supportPrice2 = null;
                let supportPrice3 = null;
                let upperLimit = null;
                let watchlisted = false;
                
                try {
                    const userStocksData = localStorage.getItem('userStocks');
                    if (userStocksData) {
                        const userStocks = JSON.parse(userStocksData);
                        if (Array.isArray(userStocks)) {
                            const stockInfo = userStocks.find(s => s && s.symbol === d.data.name);
                            if (stockInfo) {
                                supportPrice1 = stockInfo.supportPrice1;
                                supportPrice2 = stockInfo.supportPrice2;
                                supportPrice3 = stockInfo.supportPrice3;
                                upperLimit = stockInfo.upperLimit;
                                watchlisted = stockInfo.watchlist === true;
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Error getting support prices for ${d.data.name}:`, e);
                }
                
                // Calculate differences from current price if support prices exist
                const currentPrice = d.data.close;
                let diff1 = supportPrice1 ? ((currentPrice - supportPrice1) / supportPrice1 * 100).toFixed(1) + '%' : 'N/A';
                let diff2 = supportPrice2 ? ((currentPrice - supportPrice2) / supportPrice2 * 100).toFixed(1) + '%' : 'N/A';
                let diff3 = supportPrice3 ? ((currentPrice - supportPrice3) / supportPrice3 * 100).toFixed(1) + '%' : 'N/A';
                let diffUL = upperLimit ? ((currentPrice - upperLimit) / upperLimit * 100).toFixed(1) + '%' : 'N/A';
                
                // Build tooltip content with support price info if available
                let tooltipContent = `
                    <div class="tooltip-header">${d.data.name} (${d.data.sector})</div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">Change:</span>
                        <span style="color: ${d.data.originalValue >= 0 ? 'green' : 'red'}">
                            ${d.data.originalValue.toFixed(2)}%
                        </span>
                    </div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">Open:</span>
                        <span>${d.data.open.toFixed(2)}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">Close:</span>
                        <span>${d.data.close.toFixed(2)}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">Volume:</span>
                        <span>${formatNumber(d.data.volume)}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">RSI:</span>
                        <span>${d.data.rsi.toFixed(1)}</span>
                    </div>
                `;
                
                // Add support price information if available
                if (supportPrice1 || supportPrice2 || supportPrice3 || upperLimit) {
                    tooltipContent += `<div class="tooltip-divider"></div>`;
                    
                    if (supportPrice1) {
                        tooltipContent += `
                            <div class="tooltip-row">
                                <span class="tooltip-label">Support 1:</span>
                                <span>${supportPrice1.toFixed(2)} (${diff1})</span>
                            </div>
                        `;
                        
                        // Add difference percentage with color coding
                        const diff1Value = ((currentPrice - supportPrice1) / supportPrice1) * 100;
                        const diff1Class = Math.abs(diff1Value) <= maxSupportThreshold ? 'near-support' : '';
                        tooltipContent += `
                            <div class="tooltip-row ${diff1Class}">
                                <span class="tooltip-label">Proximity:</span>
                                <span>${Math.abs(diff1Value).toFixed(2)}% ${Math.abs(diff1Value) <= maxSupportThreshold ? '(Near!)' : ''}</span>
                            </div>
                        `;
                    }
                    
                    if (supportPrice2) {
                        tooltipContent += `
                            <div class="tooltip-row">
                                <span class="tooltip-label">Support 2:</span>
                                <span>${supportPrice2.toFixed(2)} (${diff2})</span>
                            </div>
                        `;
                        
                        // Add difference percentage with color coding
                        const diff2Value = ((currentPrice - supportPrice2) / supportPrice2) * 100;
                        const diff2Class = Math.abs(diff2Value) <= maxSupportThreshold ? 'near-support' : '';
                        tooltipContent += `
                            <div class="tooltip-row ${diff2Class}">
                                <span class="tooltip-label">Proximity:</span>
                                <span>${Math.abs(diff2Value).toFixed(2)}% ${Math.abs(diff2Value) <= maxSupportThreshold ? '(Near!)' : ''}</span>
                            </div>
                        `;
                    }
                    
                    if (supportPrice3) {
                        tooltipContent += `
                            <div class="tooltip-row">
                                <span class="tooltip-label">Support 3:</span>
                                <span>${supportPrice3.toFixed(2)} (${diff3})</span>
                            </div>
                        `;
                        
                        // Add difference percentage with color coding
                        const diff3Value = ((currentPrice - supportPrice3) / supportPrice3) * 100;
                        const diff3Class = Math.abs(diff3Value) <= maxSupportThreshold ? 'near-support' : '';
                        tooltipContent += `
                            <div class="tooltip-row ${diff3Class}">
                                <span class="tooltip-label">Proximity:</span>
                                <span>${Math.abs(diff3Value).toFixed(2)}% ${Math.abs(diff3Value) <= maxSupportThreshold ? '(Near!)' : ''}</span>
                            </div>
                        `;
                    }
                    
                    if (upperLimit) {
                        tooltipContent += `
                            <div class="tooltip-row">
                                <span class="tooltip-label">Upper Limit:</span>
                                <span>${upperLimit.toFixed(2)} (${diffUL})</span>
                            </div>
                        `;
                    }
                    
                    if (watchlisted) {
                        tooltipContent += `
                            <div class="tooltip-badge watchlist-badge">In Watchlist</div>
                        `;
                    }
                }
                
                // Add near support badge if near support
                const supportLevel = isNearSupportLevel(d.data.name, d.data.close);
                if (supportLevel > 0) {
                    // Color classes for different support levels
                    const supportBadgeClass = 
                        supportLevel === 1 ? 'support1-badge' : 
                        supportLevel === 2 ? 'support2-badge' : 
                        'support3-badge';
                    
                    tooltipContent += `
                        <div class="tooltip-badge ${supportBadgeClass}">Near Support ${supportLevel}</div>
                    `;
                }
                
                // Show tooltip with all info
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 0.9);
                    
                tooltip.html(tooltipContent)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function() {
                // Remove hover effect
                d3.select(this)
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 1);
                    
                // Hide tooltip
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            })
            .on('click', function(event, d) {
                // Open chart popup when clicked
                showFullScreenChart(d.data.name);
                
                // Prevent event from bubbling up
                event.stopPropagation();
            });
        
        // Add stock symbol labels with adaptive sizing
        cell.append('text')
            .attr('class', 'treemap-cell-label')
            .attr('x', 3)
            .attr('y', 12)
            .text(d => {
                const cellWidth = d.x1 - d.x0;
                // For very small cells, abbreviate the symbol if it's too long
                if (cellWidth < 35 && d.data.name.length > 4) {
                    return d.data.name.substring(0, 4);
                }
                return d.data.name;
            })
            .attr('font-size', d => {
                const cellWidth = d.x1 - d.x0;
                const cellHeight = d.y1 - d.y0;
                // Adaptive font size based on cell dimensions
                if (cellWidth < 40 || cellHeight < 40) {
                    return '8px'; // Smaller font for smaller cells
                }
                return '10px'; // Regular font for larger cells
            })
            .attr('font-weight', 'bold');
        
        // Add percent change labels with adaptive sizing
        cell.append('text')
            .attr('class', 'treemap-value-label')
            .attr('x', 3)
            .attr('y', 22)
            .text(d => {
                const cellWidth = d.x1 - d.x0;
                const cellHeight = d.y1 - d.y0;
                // For very small cells, show more compact percentage
                if (cellWidth < 35 || cellHeight < 35) {
                    return `${d.data.originalValue.toFixed(0)}%`;
                }
                return `${d.data.originalValue.toFixed(1)}%`;
            })
            .attr('font-size', d => {
                const cellWidth = d.x1 - d.x0;
                const cellHeight = d.y1 - d.y0;
                if (cellWidth < 40 || cellHeight < 40) {
                    return '7px'; // Smaller font for smaller cells
                }
                return '9px'; // Regular font for larger cells
            })
            .attr('fill', d => d.data.originalValue >= 0 ? '#008800' : '#cc0000');
        
        // Add volume info - adaptive to cell size
        cell.append('text')
            .attr('class', 'treemap-volume-label')
            .attr('x', 3)
            .attr('y', 32)
            .text(d => {
                // Only show volume for cells that are large enough
                const cellWidth = d.x1 - d.x0;
                const cellHeight = d.y1 - d.y0;
                
                // Adaptive labeling based on cell size
                if (cellWidth < 40 || cellHeight < 40) {
                    return ''; // Don't show volume for very small cells
                } else if (cellWidth < 60 || cellHeight < 50) {
                    // For medium cells, show abbreviated volume
                    return `${formatNumber(d.data.volume)}`;
                }
                // For larger cells, show full label
                return `Vol: ${formatNumber(d.data.volume)}`;
            })
            .attr('font-size', d => {
                // Adaptive font size based on cell dimensions
                const cellWidth = d.x1 - d.x0;
                const cellHeight = d.y1 - d.y0;
                if (cellWidth < 60 || cellHeight < 50) {
                    return '7px'; // Smaller font for smaller cells
                }
                return '8px'; // Regular font for larger cells
            });
            
        // Add tooltip for interactivity
        const tooltip = d3.select('body').append('div')
            .attr('class', 'treemap-tooltip')
            .style('opacity', 0);
    }
    
    // Helper functions
    function showLoading(show) {
        loadingIndicator.style.display = show ? 'flex' : 'none';
    }
    
    function getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }
    
    function getSundayToSaturdayDatesForWeek(year, weekNumber) {
        // Create a date for January 1st of the given year
        const firstDayOfYear = new Date(year, 0, 1);
        
        // Find the first Sunday of the year
        let firstSundayOfYear = new Date(year, 0, 1);
        while (firstSundayOfYear.getDay() !== 0) {
            firstSundayOfYear.setDate(firstSundayOfYear.getDate() + 1);
        }
        
        // Calculate the target Sunday (start of our week)
        // The first week starts with the first Sunday of the year
        const targetSunday = new Date(firstSundayOfYear);
        targetSunday.setDate(firstSundayOfYear.getDate() + (weekNumber - 1) * 7);
        
        // Calculate the Saturday at the end of our week
        const targetSaturday = new Date(targetSunday);
        targetSaturday.setDate(targetSunday.getDate() + 6);
        
        return {
            startDate: targetSunday,
            endDate: targetSaturday
        };
    }
    
    function isDateInRange(date, startDate, endDate) {
        return date >= startDate && date <= endDate;
    }
    
    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        }
        return num.toFixed(0);
    }
    
    function isHighVolume(volume, dataArray) {
        // Find the average volume
        const avgVolume = dataArray.reduce((sum, stock) => sum + stock.volume, 0) / dataArray.length;
        // Consider high volume if it's 2x the average
        return volume > avgVolume * 2;
    }
    
    // Create chart popup if not exists
    function createChartPopup() {
        const popupExists = document.querySelector('.chart-popup');
        if (popupExists) return;
        
        const popupHtml = `
            <div class="chart-popup">
                <div class="chart-popup-content">
                    <div class="chart-popup-header">
                        <h3 id="popupChartTitle">Stock Chart</h3>
                        <button class="chart-popup-close">&times;</button>
                    </div>
                    <div class="chart-popup-body">
                        <div id="popupChartContainer"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', popupHtml);
        
        // Add event listener to close button
        const closeButton = document.querySelector('.chart-popup-close');
        if (closeButton) {
            closeButton.addEventListener('click', function() {
                document.querySelector('.chart-popup').style.display = 'none';
            });
        }
    }
    
    // Function to check if a stock is near support levels
    // Returns 1, 2, or 3 for the respective support level, or 0 if not near any support
    function isNearSupportLevel(symbol, currentPrice) {
        try {
            const userStocksData = localStorage.getItem('userStocks');
            if (!userStocksData) return 0;
            
            const userStocks = JSON.parse(userStocksData);
            if (!Array.isArray(userStocks)) return 0;
            
            const stockInfo = userStocks.find(s => s && s.symbol === symbol);
            if (!stockInfo) return 0;
            
            // Use the adjustable threshold value
            const minThreshold = minSupportThreshold;
            const maxThreshold = maxSupportThreshold;
            
            const supportPrice1 = stockInfo.supportPrice1;
            if (supportPrice1 && !isNaN(supportPrice1)) {
                const diff = ((currentPrice - supportPrice1) / supportPrice1) * 100;
                if (diff >= minThreshold && diff <= maxThreshold) return 1;
            }
            
            const supportPrice2 = stockInfo.supportPrice2;
            if (supportPrice2 && !isNaN(supportPrice2)) {
                const diff = ((currentPrice - supportPrice2) / supportPrice2) * 100;
                if (diff >= minThreshold && diff <= maxThreshold) return 2;
            }
            
            const supportPrice3 = stockInfo.supportPrice3;
            if (supportPrice3 && !isNaN(supportPrice3)) {
                const diff = ((currentPrice - supportPrice3) / supportPrice3) * 100;
                if (diff >= minThreshold && diff <= maxThreshold) return 3;
            }
            
            return 0;
        } catch (e) {
            console.error(`Error checking support levels for ${symbol}:`, e);
            return 0;
        }
    }
    
    // Function to show full screen chart for a stock
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
            const supportColors = ["#42A5F5", "#FFA726", "#8D6E63"]; // Light blue, light orange, light brown
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
    
    // Function to fetch historical data from JSON file
    async function fetchHistoricalData() {
        try {
            showLoading(true);
            const response = await fetch('/organized_nepse_data.json');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("Fetched historical data successfully");
            
            // Process the data
            processHistoricalData(data);
            
            showLoading(false);
            return true; // Return success to allow proper promise chaining
        } catch (error) {
            console.error('Error fetching historical data:', error);
            showLoading(false);
            return false; // Return failure
        }
    }
    
    // Process historical data efficiently
    function processHistoricalData(data) {
        console.log("Processing historical data");
        
        // Reset the historical data object
        stockHistoricalData = {};
        
        // Check if data is an array
        if (!Array.isArray(data)) {
            console.error("Data is not an array");
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
                time: item.time,
                open: parseFloat(item.open),
                high: parseFloat(item.high),
                low: parseFloat(item.low),
                close: parseFloat(item.close),
                volume: parseFloat(item.volume || 0)
            });
        });
        
        console.log("Processed data for symbols:", Object.keys(stockHistoricalData));
    }
    
    // Calculate total volume for a given stock
    function calculateTotalVolume(symbol) {
        if (!stockHistoricalData[symbol]) return 0;
        
        // Calculate the total volume over the custom number of days
        return stockHistoricalData[symbol]
            .slice(-analysisDays) // Get last X days
            .reduce((sum, day) => sum + (day.volume || 0), 0);
    }
    
    // Downsample data if too many points
    function downsampleData(data, threshold = 500) {
        if (!data || data.length <= threshold) return data;
        
        const factor = Math.ceil(data.length / threshold);
        return data.filter((_, i) => i % factor === 0);
    }
}); 