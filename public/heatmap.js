document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const loadingIndicator = document.getElementById('loadingIndicator');
    const weekSelector = document.getElementById('weekSelector');
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const volumeViewBtn = document.getElementById('volumeViewBtn');
    const changeViewBtn = document.getElementById('changeViewBtn');
    const percentViewBtn = document.getElementById('percentViewBtn');
    const getStocksBtn = document.getElementById('getStocksBtn');
    
    // State variables
    let stockData = [];
    let weeklyData = {};
    let currentWeek = '';
    let currentView = 'volume'; // 'volume', 'change', 'percent'
    
    // Initialize with the current week
    const today = new Date();
    const currentYear = today.getFullYear();
    let currentWeekNum = getWeekNumber(today);
    weekSelector.value = `${currentYear}-W${currentWeekNum.toString().padStart(2, '0')}`;
    
    // Initialize event listeners
    initEventListeners();
    
    // Load data on page load
    loadData();
    
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
        applyFilterBtn.addEventListener('click', function() {
            currentWeek = weekSelector.value;
            processWeeklyData();
            updateVisualizations();
        });
        
        volumeViewBtn.addEventListener('click', function() {
            setActiveView('volume');
        });
        
        changeViewBtn.addEventListener('click', function() {
            setActiveView('change');
        });
        
        percentViewBtn.addEventListener('click', function() {
            setActiveView('percent');
        });
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
    
    async function loadData() {
        try {
            showLoading(true);
            
            // Fetch the stock data
            const response = await fetch('organized_nepse_data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            stockData = await response.json();
            currentWeek = weekSelector.value;
            
            // Process data for the selected week
            processWeeklyData();
            updateVisualizations();
            
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            showLoading(false);
        }
    }
    
    function processWeeklyData() {
        if (!currentWeek || !stockData.length) return;
        
        // Parse the week selection
        const [year, week] = currentWeek.split('-W');
        const weekNumber = parseInt(week);
        
        // Generate date range for Sunday to Saturday of selected week
        const weekDates = getSundayToSaturdayDatesForWeek(parseInt(year), weekNumber);
        
        // Group data by stock symbol and extract weekly information
        const stockGroups = {};
        
        stockData.forEach(record => {
            const recordDate = new Date(record.time.replace(/_/g, '-'));
            
            // Check if record date falls within our Sunday-Saturday range
            if (isDateInRange(recordDate, weekDates.startDate, weekDates.endDate)) {
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
                let totalVolume = 0;
                
                records.forEach(record => {
                    weeklyHigh = Math.max(weeklyHigh, record.high);
                    weeklyLow = Math.min(weeklyLow, record.low);
                    totalVolume += record.volume;
                });
                
                // Calculate volatility (high-low range as percentage of open)
                const volatility = ((weeklyHigh - weeklyLow) / weeklyOpen) * 100;
                
                // Calculate average daily volume
                const avgDailyVolume = totalVolume / records.length;
                
                // Count trading days in the week
                const tradingDays = records.length;
                
                // Calculate missing days (holidays)
                const totalDaysInWeek = 7;
                const holidayDays = totalDaysInWeek - tradingDays;
                
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
                    dailyRecords: records
                };
            }
        });
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
        
        // Sort by percent change (descending)
        dataArray.sort((a, b) => b.percentChange - a.percentChange);
        
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
            
            row.innerHTML = `
                <td>${stock.symbol}</td>
                <td>${stock.open.toFixed(2)}</td>
                <td>${stock.close.toFixed(2)}</td>
                <td class="${changeClass}">${stock.percentChange.toFixed(2)}%</td>
                <td class="${volumeClass}">${formatNumber(stock.volume)} ${holidayInfo}</td>
                <td>${stock.high.toFixed(2)}</td>
                <td>${stock.low.toFixed(2)}</td>
                <td class="${volatilityClass}">${stock.volatility.toFixed(2)}%</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    function updateHeatmaps(dataArray) {
        // Clear previous visualizations
        document.getElementById('gainersHeatmap').innerHTML = '';
        document.getElementById('losersHeatmap').innerHTML = '';
        document.getElementById('volumeHeatmap').innerHTML = '';
        document.getElementById('stableHeatmap').innerHTML = '';
        
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
            
        // Stable stocks (low volatility but reasonable volume)
        const stableStocks = [...dataArray]
            .filter(stock => stock.volatility < 5 && stock.volume > 5000)
            .sort((a, b) => a.volatility - b.volatility)
            .slice(0, 15);
        
        // Create heatmaps
        createHeatmap('gainersHeatmap', gainers, currentView);
        createHeatmap('losersHeatmap', losers, currentView);
        createHeatmap('volumeHeatmap', highestVolume, currentView);
        createHeatmap('stableHeatmap', stableStocks, currentView);
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
                    return d < 0 ? d3.interpolateReds(Math.abs(d)) : d3.interpolateGreens(d);
                });
            format = d => d.toFixed(2);
        } else { // percent
            valueAccessor = d => d.percentChange;
            colorScale = d3.scaleSequential()
                .domain([d3.min(data, d => d.percentChange), d3.max(data, d => d.percentChange)])
                .interpolator(d => {
                    return d < 0 ? d3.interpolateReds(Math.abs(d)) : d3.interpolateGreens(d);
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
        
        const y = d3.scaleLinear()
            .domain([0, d3.max(data, valueAccessor)])
            .range([height, 0]);
        
        // Create the bars
        svg.selectAll('.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.symbol))
            .attr('width', x.bandwidth())
            .attr('y', d => y(Math.max(0, valueAccessor(d))))
            .attr('height', d => Math.abs(y(valueAccessor(d)) - y(0)))
            .attr('fill', d => colorScale(valueAccessor(d)));
        
        // Add value labels
        svg.selectAll('.label')
            .data(data)
            .enter()
            .append('text')
            .attr('class', 'label')
            .attr('x', d => x(d.symbol) + x.bandwidth() / 2)
            .attr('y', d => y(valueAccessor(d)) - 5)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .text(d => format(valueAccessor(d)));
        
        // Add the x-axis
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
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
        
        // Prepare data in hierarchical structure for treemap
        const treeData = {
            name: "Stocks",
            children: []
        };
        
        // Group stocks by sectors (for demo purposes, we'll create artificial sectors based on percent change)
        const gainers = dataArray.filter(stock => stock.percentChange >= 5);
        const moderateGainers = dataArray.filter(stock => stock.percentChange < 5 && stock.percentChange >= 0);
        const moderateLosers = dataArray.filter(stock => stock.percentChange < 0 && stock.percentChange >= -5);
        const losers = dataArray.filter(stock => stock.percentChange < -5);
        
        // Add sectors with their respective stocks
        if (gainers.length > 0) {
            treeData.children.push({
                name: "Strong Gainers (>5%)",
                children: gainers.map(stock => ({
                    name: stock.symbol,
                    value: Math.abs(stock.percentChange),
                    originalValue: stock.percentChange,
                    volume: stock.volume,
                    priceChange: stock.priceChange,
                    open: stock.open,
                    close: stock.close
                }))
            });
        }
        
        if (moderateGainers.length > 0) {
            treeData.children.push({
                name: "Moderate Gainers (0-5%)",
                children: moderateGainers.map(stock => ({
                    name: stock.symbol,
                    value: Math.abs(stock.percentChange) + 0.1, // Add small value to ensure visibility
                    originalValue: stock.percentChange,
                    volume: stock.volume,
                    priceChange: stock.priceChange,
                    open: stock.open,
                    close: stock.close
                }))
            });
        }
        
        if (moderateLosers.length > 0) {
            treeData.children.push({
                name: "Moderate Losers (0 to -5%)",
                children: moderateLosers.map(stock => ({
                    name: stock.symbol,
                    value: Math.abs(stock.percentChange) + 0.1, // Add small value to ensure visibility
                    originalValue: stock.percentChange,
                    volume: stock.volume,
                    priceChange: stock.priceChange,
                    open: stock.open,
                    close: stock.close
                }))
            });
        }
        
        if (losers.length > 0) {
            treeData.children.push({
                name: "Strong Losers (< -5%)",
                children: losers.map(stock => ({
                    name: stock.symbol,
                    value: Math.abs(stock.percentChange),
                    originalValue: stock.percentChange,
                    volume: stock.volume,
                    priceChange: stock.priceChange,
                    open: stock.open,
                    close: stock.close
                }))
            });
        }
        
        // Set up dimensions
        const width = container.clientWidth;
        const height = 500;
        
        // Create the SVG container with a border
        const svg = d3.select('#treeMapContainer')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('font-family', 'sans-serif')
            .style('border-radius', '6px')
            .style('overflow', 'hidden');
        
        // Create the treemap layout
        const treemap = d3.treemap()
            .size([width, height])
            .paddingTop(20)
            .paddingBottom(10)
            .paddingRight(5)
            .paddingLeft(5)
            .paddingInner(3)
            .round(true);
        
        // Format the data for d3 hierarchy
        const root = d3.hierarchy(treeData)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value);
        
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
        
        // Add parent group labels (the categories)
        svg.selectAll('.parent')
            .data(root.children)
            .enter()
            .append('text')
            .attr('class', 'treemap-parent-label')
            .attr('x', d => d.x0 + 5)
            .attr('y', d => d.y0 + 15)
            .text(d => d.data.name)
            .attr('font-size', '14px')
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
            .attr('fill', d => colorScale(d.data.originalValue))
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .attr('class', 'treemap-cell')
            .on('mouseover', function(event, d) {
                // Add hover effect
                d3.select(this)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 2);
                    
                // Show tooltip with more info
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 0.9);
                tooltip.html(`
                    <strong>${d.data.name}</strong><br/>
                    Change: ${d.data.originalValue.toFixed(2)}%<br/>
                    Open: ${d.data.open.toFixed(2)}<br/>
                    Close: ${d.data.close.toFixed(2)}<br/>
                    Volume: ${formatNumber(d.data.volume)}
                `)
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
            });
        
        // Add stock symbol labels
        cell.append('text')
            .attr('class', 'treemap-cell-label')
            .attr('x', 5)
            .attr('y', 15)
            .text(d => d.data.name)
            .attr('font-size', '12px')
            .attr('fill', '#fff');
        
        // Add percent change labels
        cell.append('text')
            .attr('class', 'treemap-cell-label')
            .attr('x', 5)
            .attr('y', 30)
            .text(d => `${d.data.originalValue.toFixed(1)}%`)
            .attr('font-size', '11px')
            .attr('fill', '#fff')
            .attr('opacity', 0.9);
        
        // Add volume info
        cell.append('text')
            .attr('class', 'treemap-cell-label')
            .attr('x', 5)
            .attr('y', 45)
            .text(d => `Vol: ${formatNumber(d.data.volume)}`)
            .attr('font-size', '10px')
            .attr('fill', '#fff')
            .attr('opacity', 0.8);
            
        // Add tooltip for interactivity
        const tooltip = d3.select('body').append('div')
            .attr('class', 'treemap-tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('text-align', 'center')
            .style('background', 'rgba(255, 255, 255, 0.95)')
            .style('border', '1px solid #ddd')
            .style('border-radius', '4px')
            .style('padding', '8px')
            .style('font-size', '12px')
            .style('box-shadow', '0 2px 5px rgba(0,0,0,0.2)')
            .style('pointer-events', 'none');
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
        
        // Calculate days to first Sunday of the year
        const daysToFirstSunday = (7 - firstDayOfYear.getDay()) % 7;
        
        // Calculate the first Sunday of the year
        const firstSundayOfYear = new Date(year, 0, 1 + daysToFirstSunday);
        
        // Calculate the Sunday of our target week
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
}); 