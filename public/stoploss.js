// Global variables
let boughtStocks = [];
let currentPrices = {};
let stoplossStocks = [];
let stockHistoricalData = {}; // To store historical data
let chartInstances = {}; // To store chart instances by symbol
let autoRefreshInterval = null;
const DEFAULT_STOPLOSS_PERCENT = 15;

// Candlestick pattern recognition functions
function detectCandlestickPattern(candle) {
    // Make sure we have the necessary data
    if (!candle || !candle.open || !candle.high || !candle.low || !candle.close) {
        return { pattern: 'Unknown', description: 'Insufficient data' };
    }
    
    const open = parseFloat(candle.open);
    const high = parseFloat(candle.high);
    const low = parseFloat(candle.low);
    const close = parseFloat(candle.close);
    
    // Calculate candle properties
    const bodySize = Math.abs(close - open);
    const totalSize = high - low;
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;
    
    // Determine if bullish or bearish
    const isBullish = close > open;
    const isBearish = close < open;
    
    // Calculate body percentage of the total candle
    const bodyPercentage = (bodySize / totalSize) * 100;
    
    // Handle zero division
    const upperRatio = bodySize === 0 ? 0 : upperShadow / bodySize;
    const lowerRatio = bodySize === 0 ? 0 : lowerShadow / bodySize;
    
    // Doji patterns (very small body)
    if (bodyPercentage < 10) {
        // Dragonfly Doji (small body, no upper shadow, long lower shadow)
        if (upperShadow < totalSize * 0.05 && lowerShadow > totalSize * 0.5) {
            return { 
                pattern: 'Dragonfly Doji', 
                description: 'Potential reversal signal at bottom of downtrend',
                bullish: true
            };
        }
        
        // Gravestone Doji (small body, long upper shadow, no lower shadow)
        if (lowerShadow < totalSize * 0.05 && upperShadow > totalSize * 0.5) {
            return { 
                pattern: 'Gravestone Doji', 
                description: 'Potential reversal signal at top of uptrend',
                bullish: false
            };
        }
        
        // Long-Legged Doji (small body, long upper and lower shadows)
        if (upperShadow > totalSize * 0.25 && lowerShadow > totalSize * 0.25) {
            return { 
                pattern: 'Long-Legged Doji', 
                description: 'Indicates indecision in the market',
                bullish: null
            };
        }
        
        // Regular Doji
        return { 
            pattern: 'Doji', 
            description: 'Indicates indecision in the market',
            bullish: null
        };
    }
    
    // Hammer and Hanging Man (small body, little or no upper shadow, long lower shadow)
    if (bodyPercentage < 30 && upperShadow < bodySize * 0.5 && lowerShadow > bodySize * 2) {
        if (isBullish) {
            return { 
                pattern: 'Hammer', 
                description: 'Potential bullish reversal after downtrend',
                bullish: true
            };
        } else {
            return { 
                pattern: 'Hanging Man', 
                description: 'Potential bearish reversal after uptrend',
                bullish: false
            };
        }
    }
    
    // Inverted Hammer and Shooting Star (small body, long upper shadow, little or no lower shadow)
    if (bodyPercentage < 30 && lowerShadow < bodySize * 0.5 && upperShadow > bodySize * 2) {
        if (isBullish) {
            return { 
                pattern: 'Inverted Hammer', 
                description: 'Potential bullish reversal after downtrend',
                bullish: true
            };
        } else {
            return { 
                pattern: 'Shooting Star', 
                description: 'Potential bearish reversal after uptrend',
                bullish: false
            };
        }
    }
    
    // Marubozu (long body with little or no shadows)
    if (bodyPercentage > 80) {
        if (isBullish) {
            return { 
                pattern: 'Bullish Marubozu', 
                description: 'Strong buying pressure',
                bullish: true
            };
        } else {
            return { 
                pattern: 'Bearish Marubozu', 
                description: 'Strong selling pressure',
                bullish: false
            };
        }
    }
    
    // Spinning Top (small body, long upper and lower shadows)
    if (bodyPercentage < 40 && upperShadow > bodySize && lowerShadow > bodySize) {
        return { 
            pattern: 'Spinning Top', 
            description: 'Indicates indecision in the market',
            bullish: null
        };
    }
    
    // Long Bullish/Bearish Candles (large body with short shadows)
    if (bodyPercentage > 60) {
        if (isBullish) {
            return { 
                pattern: 'Bullish Candle', 
                description: 'Strong buying pressure',
                bullish: true
            };
        } else {
            return { 
                pattern: 'Bearish Candle', 
                description: 'Strong selling pressure',
                bullish: false
            };
        }
    }
    
    // Default: regular candle
    return { 
        pattern: isBullish ? 'Bullish' : 'Bearish', 
        description: isBullish ? 'Price closed higher' : 'Price closed lower',
        bullish: isBullish
    };
}

/**
 * Multi-Day Candlestick Pattern Detection Functions
 * These functions detect patterns that form across multiple days
 */

// Helper function to determine if we have enough candles for multi-day analysis
function hasEnoughCandles(candles, required = 3) {
    return candles && Array.isArray(candles) && candles.length >= required;
}

// Helper function to determine the trend direction over a period
function determineTrend(candles, days = 5) {
    if (!hasEnoughCandles(candles, days)) return null;
    
    const subset = candles.slice(-days);
    const firstClose = parseFloat(subset[0].close);
    const lastClose = parseFloat(subset[subset.length - 1].close);
    
    // Check more recent trend first (last 2-3 days)
    if (days > 3) {
        const recentCandles = candles.slice(-3);
        const recentFirstClose = parseFloat(recentCandles[0].close);
        const recentLastClose = parseFloat(recentCandles[recentCandles.length - 1].close);
        
        // If recent trend is strong, it overrides the longer trend
        if (recentLastClose > recentFirstClose * 1.01) return 'uptrend'; // 1% up in last 3 days
        if (recentLastClose < recentFirstClose * 0.99) return 'downtrend'; // 1% down in last 3 days
    }
    
    // Latest day's pattern should have more weight
    const latestCandle = candles[candles.length - 1];
    if (latestCandle.close < latestCandle.open && 
        (latestCandle.close / latestCandle.open) < 0.99) {
        return 'downtrend'; // Latest day is strongly bearish
    }
    if (latestCandle.close > latestCandle.open && 
        (latestCandle.close / latestCandle.open) > 1.01) {
        return 'uptrend'; // Latest day is strongly bullish
    }
    
    // Fall back to the full period analysis
    if (lastClose > firstClose * 1.02) return 'uptrend'; // 2% threshold
    if (lastClose < firstClose * 0.98) return 'downtrend'; // 2% threshold
    
    return 'sideways';
}

// Detect bullish engulfing pattern
function detectBullishEngulfing(candles) {
    if (!hasEnoughCandles(candles, 2)) return false;
    
    const current = candles[candles.length - 1];
    const previous = candles[candles.length - 2];
    
    // Previous day should be bearish (close < open)
    const isPreviousBearish = previous.close < previous.open;
    
    // Current day should be bullish (close > open)
    const isCurrentBullish = current.close > current.open;
    
    // Current day's body should engulf previous day's body
    const currentEngulfsPrevious = current.open < previous.close && current.close > previous.open;
    
    return isPreviousBearish && isCurrentBullish && currentEngulfsPrevious;
}

// Detect bearish engulfing pattern
function detectBearishEngulfing(candles) {
    if (!hasEnoughCandles(candles, 2)) return false;
    
    const current = candles[candles.length - 1];
    const previous = candles[candles.length - 2];
    
    // Previous day should be bullish (close > open)
    const isPreviousBullish = previous.close > previous.open;
    
    // Current day should be bearish (close < open)
    const isCurrentBearish = current.close < current.open;
    
    // Current day's body should engulf previous day's body
    const currentEngulfsPrevious = current.open > previous.close && current.close < previous.open;
    
    return isPreviousBullish && isCurrentBearish && currentEngulfsPrevious;
}

// Detect morning star pattern (bullish reversal)
function detectMorningStar(candles) {
    if (!hasEnoughCandles(candles, 3)) return false;
    
    const first = candles[candles.length - 3];
    const middle = candles[candles.length - 2];
    const last = candles[candles.length - 1];
    
    // First day: large bearish candle
    const isFirstBearish = first.close < first.open;
    const isFirstLarge = Math.abs(first.close - first.open) > (first.high - first.low) * 0.6;
    
    // Second day: small candle (could be bullish or bearish) with gap down
    const isMiddleSmall = Math.abs(middle.close - middle.open) < (middle.high - middle.low) * 0.3;
    const hasGapDown = middle.high < first.close;
    
    // Third day: large bullish candle that closes above the midpoint of the first day
    const isLastBullish = last.close > last.open;
    const isLastLarge = Math.abs(last.close - last.open) > (last.high - last.low) * 0.6;
    const closesAboveMidpoint = last.close > (first.open + first.close) / 2;
    
    return isFirstBearish && isFirstLarge && isMiddleSmall && isLastBullish && isLastLarge && (hasGapDown || closesAboveMidpoint);
}

// Detect evening star pattern (bearish reversal)
function detectEveningStar(candles) {
    if (!hasEnoughCandles(candles, 3)) return false;
    
    const first = candles[candles.length - 3];
    const middle = candles[candles.length - 2];
    const last = candles[candles.length - 1];
    
    // First day: large bullish candle
    const isFirstBullish = first.close > first.open;
    const isFirstLarge = Math.abs(first.close - first.open) > (first.high - first.low) * 0.6;
    
    // Second day: small candle (could be bullish or bearish) with gap up
    const isMiddleSmall = Math.abs(middle.close - middle.open) < (middle.high - middle.low) * 0.3;
    const hasGapUp = middle.low > first.close;
    
    // Third day: large bearish candle that closes below the midpoint of the first day
    const isLastBearish = last.close < last.open;
    const isLastLarge = Math.abs(last.close - last.open) > (last.high - last.low) * 0.6;
    const closesBelowMidpoint = last.close < (first.open + first.close) / 2;
    
    return isFirstBullish && isFirstLarge && isMiddleSmall && isLastBearish && isLastLarge && (hasGapUp || closesBelowMidpoint);
}

// Detect three white soldiers (bullish continuation)
function detectThreeWhiteSoldiers(candles) {
    if (!hasEnoughCandles(candles, 3)) return false;
    
    const first = candles[candles.length - 3];
    const middle = candles[candles.length - 2];
    const last = candles[candles.length - 1];
    
    // All three days should be bullish
    const allBullish = first.close > first.open && middle.close > middle.open && last.close > last.open;
    
    // Each day should open within previous day's body and close higher than previous day
    const properOpensAndCloses = middle.open > first.open && 
                                middle.open < first.close && 
                                middle.close > first.close &&
                                last.open > middle.open && 
                                last.open < middle.close && 
                                last.close > middle.close;
    
    // Each day should have similar size
    const similarSize = 
        Math.abs((middle.high - middle.low) / (first.high - first.low) - 1) < 0.5 &&
        Math.abs((last.high - last.low) / (middle.high - middle.low) - 1) < 0.5;
    
    return allBullish && properOpensAndCloses && similarSize;
}

// Detect three black crows (bearish continuation)
function detectThreeBlackCrows(candles) {
    if (!hasEnoughCandles(candles, 3)) return false;
    
    const first = candles[candles.length - 3];
    const middle = candles[candles.length - 2];
    const last = candles[candles.length - 1];
    
    // All three days should be bearish
    const allBearish = first.close < first.open && middle.close < middle.open && last.close < last.open;
    
    // Each day should open within previous day's body and close lower than previous day
    const properOpensAndCloses = middle.open < first.open && 
                                middle.open > first.close && 
                                middle.close < first.close &&
                                last.open < middle.open && 
                                last.open > middle.close && 
                                last.close < middle.close;
    
    // Each day should have similar size
    const similarSize = 
        Math.abs((middle.high - middle.low) / (first.high - first.low) - 1) < 0.5 &&
        Math.abs((last.high - last.low) / (middle.high - middle.low) - 1) < 0.5;
    
    return allBearish && properOpensAndCloses && similarSize;
}

// Detect dark cloud cover (bearish reversal)
function detectDarkCloudCover(candles) {
    if (!hasEnoughCandles(candles, 2)) return false;
    
    const previous = candles[candles.length - 2];
    const current = candles[candles.length - 1];
    
    // Previous day should be bullish
    const isPreviousBullish = previous.close > previous.open;
    
    // Current day should be bearish 
    const isCurrentBearish = current.close < current.open;
    
    // Current day should open above previous day's high
    const gapUp = current.open > previous.high;
    
    // Current day should close below the midpoint of previous day's body
    const closesBelowMidpoint = current.close < (previous.open + previous.close) / 2;
    
    return isPreviousBullish && isCurrentBearish && gapUp && closesBelowMidpoint;
}

// Detect piercing line (bullish reversal)
function detectPiercingLine(candles) {
    if (!hasEnoughCandles(candles, 2)) return false;
    
    const previous = candles[candles.length - 2];
    const current = candles[candles.length - 1];
    
    // Previous day should be bearish
    const isPreviousBearish = previous.close < previous.open;
    
    // Current day should be bullish
    const isCurrentBullish = current.close > current.open;
    
    // Current day should open below previous day's low
    const gapDown = current.open < previous.low;
    
    // Current day should close above the midpoint of previous day's body
    const closesAboveMidpoint = current.close > (previous.open + previous.close) / 2;
    
    return isPreviousBearish && isCurrentBullish && gapDown && closesAboveMidpoint;
}

// Detect harami pattern (reversal indicator)
function detectHarami(candles) {
    if (!hasEnoughCandles(candles, 2)) return false;
    
    const previous = candles[candles.length - 2];
    const current = candles[candles.length - 1];
    
    // Previous day should have a larger body
    const previousBodySize = Math.abs(previous.close - previous.open);
    const currentBodySize = Math.abs(current.close - current.open);
    
    // Current day's body should be completely contained within previous day's body
    const isContained = (current.open > Math.min(previous.open, previous.close) &&
                         current.open < Math.max(previous.open, previous.close) &&
                         current.close > Math.min(previous.open, previous.close) &&
                         current.close < Math.max(previous.open, previous.close));
    
    return previousBodySize > currentBodySize * 2 && isContained;
}

// Main function to detect multi-day patterns
function detectMultiDayPatterns(symbol) {
    const candles = stockHistoricalData[symbol];
    if (!hasEnoughCandles(candles, 5)) {
        return { 
            pattern: 'Unknown', 
            description: 'Insufficient historical data',
            bullish: null,
            details: null
        };
    }
    
    // Get recent candles for analysis
    const recentCandles = candles.slice(-10); // Last 10 days
    
    // Determine the current trend
    const trend = determineTrend(recentCandles);
    
    // Check for various patterns in order of priority
    if (detectThreeWhiteSoldiers(recentCandles)) {
        return {
            pattern: 'Three White Soldiers',
            description: 'Strong bullish continuation pattern with three consecutive bullish candles',
            bullish: true,
            details: 'Indicates strengthening buyer momentum and likely further upward movement',
            trend: trend
        };
    }
    
    if (detectThreeBlackCrows(recentCandles)) {
        return {
            pattern: 'Three Black Crows',
            description: 'Strong bearish continuation pattern with three consecutive bearish candles',
            bullish: false,
            details: 'Indicates strengthening seller momentum and likely further downward movement',
            trend: trend
        };
    }
    
    if (detectMorningStar(recentCandles)) {
        return {
            pattern: 'Morning Star',
            description: 'Bullish reversal pattern indicating a potential bottom',
            bullish: true,
            details: 'Shows rejection of lower prices and potential trend reversal upward',
            trend: trend
        };
    }
    
    if (detectEveningStar(recentCandles)) {
        return {
            pattern: 'Evening Star',
            description: 'Bearish reversal pattern indicating a potential top',
            bullish: false,
            details: 'Shows rejection of higher prices and potential trend reversal downward',
            trend: trend
        };
    }
    
    if (detectBullishEngulfing(recentCandles)) {
        return {
            pattern: 'Bullish Engulfing',
            description: 'A larger bullish candle engulfs the previous bearish candle',
            bullish: true,
            details: 'Shows strong buying pressure overcoming previous selling pressure',
            trend: trend
        };
    }
    
    if (detectBearishEngulfing(recentCandles)) {
        return {
            pattern: 'Bearish Engulfing',
            description: 'A larger bearish candle engulfs the previous bullish candle',
            bullish: false,
            details: 'Shows strong selling pressure overcoming previous buying pressure',
            trend: trend
        };
    }
    
    if (detectDarkCloudCover(recentCandles)) {
        return {
            pattern: 'Dark Cloud Cover',
            description: 'Bearish reversal pattern with a strong down day after an up day',
            bullish: false,
            details: 'Current bearish candle opens higher but closes well into the previous bullish candle',
            trend: trend
        };
    }
    
    if (detectPiercingLine(recentCandles)) {
        return {
            pattern: 'Piercing Line',
            description: 'Bullish reversal pattern with a strong up day after a down day',
            bullish: true,
            details: 'Current bullish candle opens lower but closes well into the previous bearish candle',
            trend: trend
        };
    }
    
    if (detectHarami(recentCandles)) {
        const isCurrentBullish = recentCandles[recentCandles.length - 1].close > recentCandles[recentCandles.length - 1].open;
        return {
            pattern: isCurrentBullish ? 'Bullish Harami' : 'Bearish Harami',
            description: `${isCurrentBullish ? 'Bullish' : 'Bearish'} reversal pattern with a small inside day`,
            bullish: isCurrentBullish,
            details: 'A small candle contained within the body of the previous larger candle, indicating potential reversal',
            trend: trend
        };
    }
    
    // If no multi-day patterns found, just return the single candle pattern with trend information
    const latestCandle = candles[candles.length - 1];
    const singlePattern = detectCandlestickPattern(latestCandle);
    
    return {
        ...singlePattern,
        trend: trend
    };
}

// Combine single day and multi-day pattern analysis
function analyzeCandlePatterns(symbol) {
    if (!stockHistoricalData[symbol] || stockHistoricalData[symbol].length === 0) {
        return {
            single: { pattern: 'Unknown', description: 'No data available', bullish: null },
            multi: { pattern: 'Unknown', description: 'No data available', bullish: null },
            trend: null,
            direction: null
        };
    }
    
    // Get the latest single candle pattern
    const latestCandle = getLatestCandle(symbol);
    const singlePattern = detectCandlestickPattern(latestCandle);
    
    // Get multi-day patterns
    const multiPattern = detectMultiDayPatterns(symbol);
    
    // Determine the final predicted direction based on both patterns
    let direction = null;
    
    if (multiPattern.bullish === true) {
        direction = 'up';
    } else if (multiPattern.bullish === false) {
        direction = 'down';
    } else if (singlePattern.bullish === true) {
        direction = 'up';
    } else if (singlePattern.bullish === false) {
        direction = 'down';
    }
    
    return {
        single: singlePattern,
        multi: multiPattern,
        trend: multiPattern.trend || null,
        direction: direction
    };
}

// Get the latest candle from historical data
function getLatestCandle(symbol) {
    if (!stockHistoricalData[symbol] || stockHistoricalData[symbol].length === 0) {
        return null;
    }
    
    return stockHistoricalData[symbol][stockHistoricalData[symbol].length - 1];
}

document.addEventListener('DOMContentLoaded', function() {
    // Store reference to common watchlist function to avoid naming conflicts
    // IMPORTANT: Save the reference before our own toggleWatchlist is exported
    if (typeof window.toggleWatchlist === 'function') {
        window.commonToggleWatchlist = window.toggleWatchlist;
        // Don't delete the original as other scripts may depend on it
    }
    
    // Initialize default stoploss percent input field right away
    const defaultStoplossInput = document.getElementById('defaultStoplossPercent');
    if (defaultStoplossInput) {
        const storedStoplossPercent = localStorage.getItem('defaultStoplossPercent');
        if (storedStoplossPercent) {
            defaultStoplossInput.value = storedStoplossPercent;
        } else {
            defaultStoplossInput.value = DEFAULT_STOPLOSS_PERCENT;
            // Also save it to localStorage
            localStorage.setItem('defaultStoplossPercent', DEFAULT_STOPLOSS_PERCENT.toString());
        }
    }
    
    initializePage();
    setupEventListeners();
    
    // Create chart popup element if not exists
    if (!document.querySelector('.chart-popup')) {
        createChartPopup();
    }
    
    // Initialize watchlist with our local function registered
    window.toggleWatchlist = toggleWatchlist; // Export our function
    if (typeof initWatchlist === 'function') {
        initWatchlist();
    }
    
    // Fetch historical data
    fetchHistoricalData();
    
    // Start auto-refresh if enabled
    setupAutoRefresh();
    
    // Setup Excel upload and download event listeners
    setupExcelHandlers();
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
    
    // Add styles for candle pattern tooltip in the popup
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .pattern-details {
            display: inline-flex;
            gap: 10px;
            margin-left: 15px;
            align-items: center;
        }
        
        .pattern-container {
            display: flex;
            flex-direction: column;
            gap: 5px;
            margin-top: 5px;
        }
        
        .chart-popup-header .candle-pattern {
            display: inline-block;
            padding: 3px 6px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            background-color: #f5f5f5;
            border: 1px solid #ddd;
            position: relative;
            cursor: help;
        }
        
        .chart-popup-header .candle-pattern.bullish {
            color: #4caf50;
            border-color: #4caf50;
            background-color: rgba(76, 175, 80, 0.1);
        }
        
        .chart-popup-header .candle-pattern.bearish {
            color: #f44336;
            border-color: #f44336;
            background-color: rgba(244, 67, 54, 0.1);
        }
        
        .chart-popup-header .candle-pattern.neutral {
            color: #ff9800;
            border-color: #ff9800;
            background-color: rgba(255, 152, 0, 0.1);
        }
        
        .chart-popup-header .candle-pattern .tooltip-text {
            visibility: hidden;
            width: 220px;
            background-color: #333;
            color: #fff;
            text-align: center;
            border-radius: 4px;
            padding: 8px;
            position: absolute;
            z-index: 10;
            bottom: 125%;
            left: 50%;
            margin-left: -110px;
            opacity: 0;
            transition: opacity 0.3s;
            font-weight: normal;
            white-space: normal;
            line-height: 1.4;
        }
        
        .chart-popup-header .candle-pattern:hover .tooltip-text {
            visibility: visible;
            opacity: 1;
        }
    `;
    document.head.appendChild(styleElement);
    
    // Add event listener to close button
    document.querySelector('.chart-popup-close').addEventListener('click', () => {
        document.querySelector('.chart-popup').style.display = 'none';
    });
}

function initializePage() {
    loadBoughtStocks();
    loadCurrentPrices();
    loadStoplossData();
}

function setupEventListeners() {
    document.getElementById('refreshStoplossListBtn').addEventListener('click', () => {
        fetchCurrentPrices().then(() => {
            processStoplossStocks();
        });
    });
    
    // Auto-refresh toggle
    const autoRefreshBtn = document.getElementById('autoRefreshBtn');
    const isAutoRefreshEnabled = localStorage.getItem('autoRefreshEnabled') === 'true';
    autoRefreshBtn.textContent = isAutoRefreshEnabled ? 'Disable Auto Refresh' : 'Enable Auto Refresh';
    autoRefreshBtn.addEventListener('click', toggleAutoRefresh);
    
    // Default stoploss percentage
    document.getElementById('defaultStoplossPercent').addEventListener('change', (e) => {
        const value = parseInt(e.target.value);
        if (value > 0 && value <= 100) {
            localStorage.setItem('defaultStoplossPercent', value.toString());
            processStoplossStocks();
        }
    });
    
    // Show broken stoploss checkbox
    document.getElementById('showBrokenStoploss').addEventListener('change', (e) => {
        // Get the checked state
        const showHighlighting = e.target.checked;
        console.log(`Toggling broken stoploss highlighting: ${showHighlighting ? 'ON' : 'OFF'}`);
        
        // Update all rows directly for immediate visual feedback
        const brokenRows = document.querySelectorAll('#stoplossTable tbody tr.broken-stoploss');
        console.log(`Found ${brokenRows.length} rows with broken stoploss to update`);
        
        brokenRows.forEach(row => {
            if (showHighlighting) {
                row.classList.remove('highlight-disabled');
                console.log(`Enabling highlight for ${row.querySelector('.clickable-symbol').textContent}`);
            } else {
                row.classList.add('highlight-disabled');
                console.log(`Disabling highlight for ${row.querySelector('.clickable-symbol').textContent}`);
            }
        });
        
        // Still refresh the full list to ensure proper sorting/state
        processStoplossStocks();
    });
    
    // Set default stoploss percent from localStorage or default
    // Only set if the input field is empty or has no value (don't overwrite value set in DOMContentLoaded)
    const defaultStoplossInput = document.getElementById('defaultStoplossPercent');
    if (defaultStoplossInput && (!defaultStoplossInput.value || defaultStoplossInput.value === '0')) {
        const storedStoplossPercent = localStorage.getItem('defaultStoplossPercent');
        if (storedStoplossPercent) {
            defaultStoplossInput.value = storedStoplossPercent;
            console.log(`setupEventListeners: Set stoploss to stored value: ${storedStoplossPercent}%`);
        } else {
            defaultStoplossInput.value = DEFAULT_STOPLOSS_PERCENT;
            localStorage.setItem('defaultStoplossPercent', DEFAULT_STOPLOSS_PERCENT.toString());
            console.log(`setupEventListeners: No stored stoploss found, using default: ${DEFAULT_STOPLOSS_PERCENT}%`);
        }
    }
    
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

// Setup Excel upload and download functionality
function setupExcelHandlers() {
    // Set up download Excel button
    document.getElementById('downloadExcel').addEventListener('click', function() {
        // Get bought stocks for export
        const boughtStocks = JSON.parse(localStorage.getItem('boughtStocks') || '[]');
        
        // Format data to match the simpler format shown in the image
        const formattedData = boughtStocks.map(stock => {
            return {
                'SYMBOL': stock.symbol,
                'BUY/SELL': 'Buy',
                'TRADE QTY': stock.quantity || 10,
                'PRICE(NPR)': stock.buyPrice
            };
        });
        
        // Create worksheet with the formatted data
        const worksheet = XLSX.utils.json_to_sheet(formattedData);
        
        // Define column order to match screenshot exactly
        const columnOrder = ['SYMBOL', 'BUY/SELL', 'TRADE QTY', 'PRICE(NPR)'];
        
        // Set column widths to match screenshot format
        const columnWidths = [
            { wch: 15 }, // SYMBOL
            { wch: 10 }, // BUY/SELL 
            { wch: 10 }, // TRADE QTY
            { wch: 12 }  // PRICE(NPR)
        ];
        
        // Apply column widths
        worksheet['!cols'] = columnWidths;
        
        // Create a workbook
        const workbook = XLSX.utils.book_new();
        
        // Add the worksheet
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Stoploss');
        
        // Generate buffer and download
        XLSX.writeFile(workbook, 'stoploss_stocks.xlsx');
    });

    // Set up upload Excel button
    document.getElementById('uploadExcel').addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            let json = [];
            
            // Check if it's a CSV file
            if (file.name.toLowerCase().endsWith('.csv')) {
                // Parse CSV data
                const csvData = e.target.result;
                const lines = csvData.split(/\r?\n/); // Handle different line endings
                
                if (lines.length === 0) {
                    showError('No data found in the CSV file');
                    return;
                }
                
                // Detect delimiter - check if it's tab, comma, or space separated
                let delimiter = ','; // Default delimiter
                const firstLine = lines[0];
                
                // Count occurrences of potential delimiters
                const delimiterCounts = {
                    ',': (firstLine.match(/,/g) || []).length,
                    '\t': (firstLine.match(/\t/g) || []).length,
                    ' ': (firstLine.match(/ {2,}/g) || []).length // Multiple spaces as delimiter
                };
                
                // Determine most likely delimiter
                if (delimiterCounts['\t'] > 0) {
                    delimiter = '\t';
                } else if (delimiterCounts[','] > 0) {
                    delimiter = ',';
                } else if (delimiterCounts[' '] > 0) {
                    // For space delimited files, we'll split by multiple spaces
                    delimiter = ' ';
                }
                
                // Extract headers (first line)
                let headers;
                if (delimiter === ' ') {
                    // For space-delimited files, split by multiple spaces and trim
                    headers = firstLine.split(/\s{2,}/).map(header => header.trim());
                } else {
                    headers = firstLine.split(delimiter).map(header => header.trim());
                }
                
                // Process each line
                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim() === '') continue; // Skip empty lines
                    
                    let values;
                    if (delimiter === ' ') {
                        // For space-delimited files, split by multiple spaces
                        values = lines[i].split(/\s{2,}/).map(value => value.trim());
                    } else {
                        values = lines[i].split(delimiter).map(value => value.trim());
                    }
                    
                    const row = {};
                    
                    // Map values to headers
                    headers.forEach((header, index) => {
                        if (index < values.length) {
                            row[header] = values[index];
                        }
                    });
                    
                    json.push(row);
                }
                
                // Handle specific format from the user's image
                // Map column names to expected fields if needed
                json = json.map(row => {
                    const mappedRow = {...row};
                    
                    // Map common column names from the user's format
                    if (row['CONTRACT NO'] !== undefined) mappedRow['CONTRACT_NO'] = row['CONTRACT NO'];
                    if (row['CLIENT'] !== undefined) mappedRow['CLIENT_ID'] = row['CLIENT'];
                    if (row['CLIENT NAME'] !== undefined) mappedRow['CLIENT_NAME'] = row['CLIENT NAME'];
                    if (row['SYMBOL'] !== undefined) mappedRow['SYMBOL'] = row['SYMBOL'];
                    if (row['TYPE'] !== undefined) mappedRow['BUY'] = row['TYPE']; // Map TYPE to BUY for compatibility
                    if (row['PRICE'] !== undefined) mappedRow['PRICE'] = row['PRICE'];
                    if (row['QTY'] !== undefined) mappedRow['QTY'] = row['QTY'];
                    if (row['VALUE'] !== undefined) mappedRow['VALUE'] = row['VALUE'];
                    if (row['ORDER ID'] !== undefined) mappedRow['ORDER_ID'] = row['ORDER ID'];
                    if (row['TRADE TIME'] !== undefined) mappedRow['TRADE_TIME'] = row['TRADE TIME'];
                    
                    return mappedRow;
                });
            } else {
                // Process Excel file as before
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                if (workbook.SheetNames.length > 0) {
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    json = XLSX.utils.sheet_to_json(worksheet);
                } else {
                    showError('Invalid Excel file: No sheets found');
                    return;
                }
            }
            
            if (json.length === 0) {
                showError('No data found in the file');
                return;
            }
            
            // Log the first row to check structure
            console.log("First row of imported data:", json[0]);
            
            // Get existing bought stocks
            const existingBoughtStocks = JSON.parse(localStorage.getItem('boughtStocks') || '[]');
            
            // Get current stoploss percentage for calculations
            const defaultStoplossPercent = parseInt(document.getElementById('defaultStoplossPercent').value) || DEFAULT_STOPLOSS_PERCENT;
            console.log(`Excel import using stoploss percentage: ${defaultStoplossPercent}%`);
            
            // Process each row from the file - support both traditional format and new CSV format
            const newBoughtStocks = json
                .filter(row => {
                    // For traditional Excel format
                    if (row['BUY/SELL'] !== undefined) {
                        return row['BUY/SELL'] === 'Buy' || row['BUY/SELL'] === 'buy';
                    }
                    
                    // For BUY column format
                    if (row.BUY !== undefined) {
                        return row.BUY === 'Buy' || row.BUY === 'buy';
                    }
                    
                    // For TYPE column format (from user's CSV)
                    if (row.TYPE !== undefined) {
                        return row.TYPE === 'Buy' || row.TYPE === 'buy';
                    }
                    
                    return false;
                })
                .map(row => {
                    // Today's date as string in ISO format - this will be the import date
                    const today = new Date().toISOString().split('T')[0];
                    
                    // Try to extract actual date from TRADE TIME if available
                    let buyDate = today;
                    if (row['TRADE TIME']) {
                        try {
                            // Example format: 2025-04-27 14:40:22
                            const datePart = row['TRADE TIME'].split(' ')[0];
                            if (datePart && datePart.includes('-')) {
                                buyDate = datePart;
                            }
                        } catch (e) {
                            console.error('Error parsing trade date:', e);
                        }
                    } else if (row['TRADE_TIME']) {
                        try {
                            // Alternative field name
                            const datePart = row['TRADE_TIME'].split(' ')[0];
                            if (datePart && datePart.includes('-')) {
                                buyDate = datePart;
                            }
                        } catch (e) {
                            console.error('Error parsing trade date:', e);
                        }
                    }
                    
                    // Extract symbol - handle different possible column names
                    const symbol = row.SYMBOL || row.Symbol || row.symbol;
                    
                    // Extract price - handle different possible column names
                    let buyPrice = 0;
                    if (row['PRICE(NPR)'] !== undefined) {
                        buyPrice = Number(row['PRICE(NPR)']);
                    } else if (row.PRICE !== undefined) {
                        buyPrice = Number(row.PRICE);
                    } else if (row.Price !== undefined) {
                        buyPrice = Number(row.Price);
                    }
                    
                    // Extract quantity - handle different possible column names
                    let quantity = 10; // Default
                    if (row['TRADE QTY'] !== undefined) {
                        quantity = Number(row['TRADE QTY']);
                    } else if (row.QTY !== undefined) {
                        quantity = Number(row.QTY);
                    } else if (row.Quantity !== undefined) {
                        quantity = Number(row.Quantity);
                    }
                    
                    // Calculate stoploss price and mark as auto-generated so we can recalculate it later
                    const stoplossPrice = parseFloat((buyPrice * (1 - defaultStoplossPercent / 100)).toFixed(2));
                    
                    return {
                        symbol: symbol,
                        buyPrice: parseFloat(buyPrice.toFixed(2)),
                        buyDate: buyDate,
                        stoplossPrice: stoplossPrice,
                        quantity: quantity,
                        importedViaExcel: true,  // Mark as imported via Excel
                        stoplossPercentUsed: defaultStoplossPercent // Store the stoploss percent used for this calculation
                    };
                });
            
            if (newBoughtStocks.length === 0) {
                showError('No valid buy trades found in the file');
                return;
            }
            
            console.log('Preview of stocks to be imported:', newBoughtStocks);
            
            // Remove duplicates and merge with existing stocks
            const mergedStocks = [...existingBoughtStocks];
            
            newBoughtStocks.forEach(newStock => {
                // Find if this stock already exists
                const existingIndex = mergedStocks.findIndex(stock => stock.symbol === newStock.symbol);
                
                if (existingIndex >= 0) {
                    // Check if there's a manually set stoploss price
                    const existingStock = mergedStocks[existingIndex];
                    
                    // If existing stock has a manually set stoploss (different from default),
                    // preserve it instead of overwriting with the default
                    if (existingStock.stoplossPrice) {
                        // Check if this is a manually set stoploss or an auto-generated one
                        const isManualStoploss = !existingStock.importedViaExcel || 
                            (existingStock.importedViaExcel && existingStock.manuallyUpdated);
                            
                        if (isManualStoploss) {
                            // If manually set, keep it
                            newStock.stoplossPrice = existingStock.stoplossPrice;
                            newStock.manuallyUpdated = true; // Mark as manually updated
                            console.log(`Keeping manually set stoploss for ${newStock.symbol}: ${newStock.stoplossPrice}`);
                        }
                    }
                    
                    // Update existing stock
                    mergedStocks[existingIndex] = {
                        ...existingStock,
                        ...newStock
                    };
                } else {
                    // Add new stock
                    mergedStocks.push(newStock);
                }
            });
            
            // Save the updated bought stocks
            localStorage.setItem('boughtStocks', JSON.stringify(mergedStocks));
            
            // Reload the bought stocks
            loadBoughtStocks();
            
            // Always refetch current prices to ensure up-to-date data
            showLoading(true);
            fetchCurrentPrices().then((prices) => {
                // Update current prices
                currentPrices = prices;
                
                // Force checking if any stocks have broken stoploss
                mergedStocks.forEach(stock => {
                    const currentPrice = currentPrices[stock.symbol] || 0;
                    if (currentPrice > 0 && currentPrice <= stock.stoplossPrice) {
                        console.log(`IMPORT CHECK: ${stock.symbol} has broken stoploss: LTP=${currentPrice}, Stoploss=${stock.stoplossPrice}`);
                    }
                });
                
                // Process stoploss stocks after prices are fetched
                processStoplossStocks();
                
                // Show success message after processing is complete
                showSuccess(`${newBoughtStocks.length} stocks imported successfully!`);
                showLoading(false);
            }).catch(error => {
                console.error('Error fetching prices after import:', error);
                // Still process with whatever prices we have
                processStoplossStocks();
                showSuccess(`${newBoughtStocks.length} stocks imported, but price data may be incomplete.`);
                showLoading(false);
            });
        };
        
        // Read the file - determine how to read it based on file type
        if (file.name.toLowerCase().endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    });
}

function setupAutoRefresh() {
    clearInterval(autoRefreshInterval);
    
    const isAutoRefreshEnabled = localStorage.getItem('autoRefreshEnabled') === 'true';
    if (isAutoRefreshEnabled) {
        // Refresh prices every 60 seconds
        autoRefreshInterval = setInterval(() => {
            fetchCurrentPrices().then(() => {
                processStoplossStocks();
            });
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

function loadBoughtStocks() {
    boughtStocks = JSON.parse(localStorage.getItem('boughtStocks') || '[]');
    
    // Check if there are user stocks with stoploss data in localStorage
    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    
    if (userStocks && Array.isArray(userStocks) && userStocks.length > 0) {
        console.log('Checking user stocks for stoploss values');
        
        // Create a map of symbols to their stoploss prices from user stocks
        const stoplossMap = {};
        
        userStocks.forEach(stock => {
            // Check if this stock has stoploss data
            if (stock.symbol && stock.stoplossPrice) {
                const stoplossPrice = parseFloat(stock.stoplossPrice);
                
                if (!isNaN(stoplossPrice) && stoplossPrice > 0) {
                    stoplossMap[stock.symbol] = stoplossPrice;
                    console.log(`Found stoploss for ${stock.symbol}: ${stoplossPrice}`);
                }
            }
        });
        
        // Update boughtStocks with stoploss prices from user stocks
        if (Object.keys(stoplossMap).length > 0) {
            let updatedCount = 0;
            
            boughtStocks = boughtStocks.map(stock => {
                if (stoplossMap[stock.symbol]) {
                    updatedCount++;
                    return {
                        ...stock,
                        stoplossPrice: stoplossMap[stock.symbol],
                        manuallyUpdated: true // Mark as manually updated so it won't be overridden
                    };
                }
                return stock;
            });
            
            // Save updated boughtStocks
            if (updatedCount > 0) {
                localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
                console.log(`Updated stoploss prices for ${updatedCount} stocks from user stocks data`);
                showSuccess(`Updated stoploss prices for ${updatedCount} stocks from uploaded Excel`);
            }
        }
    }
}

async function fetchCurrentPrices() {
    showLoading(true);
    try {
        // Try to load prices from localStorage first (set by dashboard)
        const storedPrices = localStorage.getItem('currentPrices');
        
        if (storedPrices) {
            currentPrices = JSON.parse(storedPrices);
            showLoading(false);
            return currentPrices;
        }
        
        // Fallback to API if localStorage prices are not available
        console.warn('No stored prices found in localStorage. Using API fallback.');
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

function processStoplossStocks() {
    const defaultStoplossPercent = parseInt(document.getElementById('defaultStoplossPercent').value) || DEFAULT_STOPLOSS_PERCENT;
    console.log(`Processing stoploss stocks with defaultStoplossPercent: ${defaultStoplossPercent}`);
    
    stoplossStocks = [];
    
    // Debug counter for monitoring
    let brokenCount = 0;
    
    // First, update any stocks that should use automatic stoploss calculation
    // This includes Excel-imported stocks and stocks from dashboard without manual stoploss
    const updatedBoughtStocks = boughtStocks.map(stock => {
        // Check for several conditions to determine if we should auto-update this stock:
        // 1. Excel-imported stocks that haven't been manually modified
        // 2. Dashboard-added stocks that don't have the manuallyUpdated flag
        // 3. Any stock with autoUpdateStoploss flag set to true
        const shouldAutoUpdate = 
            (stock.importedViaExcel && !stock.manuallyUpdated) || 
            (!stock.importedViaExcel && !stock.manuallyUpdated) ||
            stock.autoUpdateStoploss === true;
            
        // Only update if there's a percentage change or the stock doesn't have stoplossPercentUsed property
        if (shouldAutoUpdate && (stock.stoplossPercentUsed !== defaultStoplossPercent || !('stoplossPercentUsed' in stock))) {
            const newStoplossPrice = parseFloat((stock.buyPrice * (1 - defaultStoplossPercent / 100)).toFixed(2));
            
            // Only log if there's an actual change
            if (!stock.stoplossPrice || Math.abs(stock.stoplossPrice - newStoplossPrice) > 0.01) {
                const oldValue = stock.stoplossPrice || "unset";
                console.log(`Updating stoploss for ${stock.symbol} from ${oldValue} to ${newStoplossPrice} (${stock.stoplossPercentUsed || "unset"}% -> ${defaultStoplossPercent}%)`);
            }
            
            // Update stoploss price and percentage used
            return {
                ...stock,
                stoplossPrice: newStoplossPrice,
                stoplossPercentUsed: defaultStoplossPercent,
                autoUpdateStoploss: true // Mark for future auto-updates
            };
        }
        
        // For stocks that don't need updates, still make sure they have the stoplossPercentUsed property
        if (!('stoplossPercentUsed' in stock)) {
            return {
                ...stock,
                stoplossPercentUsed: defaultStoplossPercent
            };
        }
        
        return stock;
    });
    
    // If any stocks were updated, save to localStorage
    if (JSON.stringify(updatedBoughtStocks) !== JSON.stringify(boughtStocks)) {
        boughtStocks = updatedBoughtStocks;
        localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
        console.log("Updated stoploss prices for automatically managed stocks based on new percentage");
    }
    
    boughtStocks.forEach(stock => {
        const currentPrice = currentPrices[stock.symbol] || 0;
        if (currentPrice <= 0) return;
        
        // Calculate return percentage
        const returnPercent = ((currentPrice - stock.buyPrice) / stock.buyPrice) * 100;
        
        // Calculate stoploss price - ensure we have a valid stoploss price
        let stoplossPrice = parseFloat(stock.stoplossPrice);
        
        // If stoploss price is missing or invalid, calculate it based on the default percentage
        if (isNaN(stoplossPrice) || stoplossPrice <= 0) {
            stoplossPrice = stock.buyPrice * (1 - defaultStoplossPercent / 100);
            console.log(`Fixed stoploss price for ${stock.symbol}: ${stoplossPrice} (${defaultStoplossPercent}%)`);
            
            // Update the stock in the boughtStocks array with this calculated stoploss
            const stockIndex = boughtStocks.findIndex(s => s.symbol === stock.symbol);
            if (stockIndex !== -1) {
                boughtStocks[stockIndex].stoplossPrice = stoplossPrice;
                boughtStocks[stockIndex].stoplossPercentUsed = defaultStoplossPercent;
                boughtStocks[stockIndex].autoUpdateStoploss = true;
                
                // Save the updated boughtStocks to localStorage
                localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
            }
        }
        
        // Calculate stoploss difference
        const stoplossDiff = ((currentPrice - stoplossPrice) / stoplossPrice) * 100;
        
        // Check if stoploss is broken - using stricter comparison with parsed values
        const isBroken = parseFloat(currentPrice) <= parseFloat(stoplossPrice);
        
        if (isBroken) {
            brokenCount++;
            console.log(`${stock.symbol} has broken stoploss: LTP=${currentPrice}, Stoploss=${stoplossPrice}`);
        }
        
        stoplossStocks.push({
            symbol: stock.symbol,
            ltp: currentPrice,
            buyPrice: stock.buyPrice,
            returnPercent: returnPercent,
            stoplossPrice: stoplossPrice,
            stoplossDiff: stoplossDiff,
            buyDate: stock.buyDate || 'Unknown',
            quantity: stock.quantity || 10,
            isBroken: isBroken,
            importedViaExcel: stock.importedViaExcel || false,
            manuallyUpdated: stock.manuallyUpdated || false,
            autoUpdateStoploss: stock.autoUpdateStoploss || false
        });
    });
    
    console.log(`Total stocks with broken stoploss: ${brokenCount}/${boughtStocks.length}`);
    
    // Sort by broken stoploss first, then by stoploss difference
    stoplossStocks.sort((a, b) => {
        if (a.isBroken !== b.isBroken) {
            return a.isBroken ? -1 : 1;
        }
        return a.stoplossDiff - b.stoplossDiff;
    });
    
    // Display the stoploss stocks
    displayStoplossStocks();
}

function displayStoplossStocks() {
    const tableBody = document.querySelector('#stoplossTable tbody');
    tableBody.innerHTML = '';
    
    if (stoplossStocks.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="9" class="no-data">No bought stocks found</td>
        `;
        tableBody.appendChild(row);
        
        // Reset stoploss counter
        document.getElementById('stoplossCounter').textContent = '';
        return;
    }
    
    // Clean up old chart instances
    Object.keys(chartInstances).forEach(symbol => {
        if (chartInstances[symbol] && chartInstances[symbol].chart) {
            chartInstances[symbol].chart.remove();
            delete chartInstances[symbol];
        }
    });
    
    const showBrokenStoploss = document.getElementById('showBrokenStoploss').checked;
    
    // Count broken stoploss stocks
    const brokenStoplossCount = stoplossStocks.filter(stock => stock.isBroken).length;
    
    // Log for debugging
    console.log(`Displaying ${stoplossStocks.length} stocks, ${brokenStoplossCount} have broken stoploss.`);
    stoplossStocks.filter(stock => stock.isBroken).forEach(stock => {
        console.log(`Displaying broken stoploss: ${stock.symbol}, LTP: ${stock.ltp}, SL: ${stock.stoplossPrice}`);
    });
    
    // Update the stoploss counter
    const stoplossCounterEl = document.getElementById('stoplossCounter');
    if (brokenStoplossCount > 0) {
        stoplossCounterEl.textContent = `Alert: ${brokenStoplossCount} stock${brokenStoplossCount > 1 ? 's' : ''} broke stoploss price!`;
        stoplossCounterEl.className = 'has-broken';
    } else {
        stoplossCounterEl.textContent = 'No stocks have broken stoploss price';
        stoplossCounterEl.className = 'no-broken';
    }
    
    stoplossStocks.forEach((stock, index) => {
        const row = document.createElement('tr');
        
        // Always add a data attribute for isBroken status - this helps debugging
        row.setAttribute('data-broken', stock.isBroken ? 'true' : 'false');
        
        // Add broken-stoploss class if the stock has broken stoploss
        // Always apply highlighting for broken stoploss, but only make it visible
        // based on the checkbox state through CSS
        if (stock.isBroken) {
            row.classList.add('broken-stoploss');
            
            // Add additional class to control visibility through CSS
            if (!showBrokenStoploss) {
                row.classList.add('highlight-disabled');
            }
        }
        
        // Format date
        const buyDate = new Date(stock.buyDate);
        const formattedDate = isNaN(buyDate) ? 'Unknown' : buyDate.toLocaleDateString();
        
        // Get the candle pattern analysis (both single day and multi-day patterns)
        const patternAnalysis = analyzeCandlePatterns(stock.symbol);
        
        // Determine CSS class for the candle pattern
        let singlePatternClass = 'neutral';
        if (patternAnalysis.single.bullish === true) {
            singlePatternClass = 'bullish';
        } else if (patternAnalysis.single.bullish === false) {
            singlePatternClass = 'bearish';
        }
        
        let multiPatternClass = 'neutral';
        if (patternAnalysis.multi.bullish === true) {
            multiPatternClass = 'bullish';
        } else if (patternAnalysis.multi.bullish === false) {
            multiPatternClass = 'bearish';
        }
        
        // Direction indicator
        const directionIndicator = patternAnalysis.direction === 'up' ? '↑' : 
                                  patternAnalysis.direction === 'down' ? '↓' : 
                                  '→';
        
        // Create the row HTML content (without the watchlist button)
        row.innerHTML = `
            <td class="clickable-symbol" data-symbol="${stock.symbol}">${stock.symbol}</td>
            <td>${stock.ltp.toFixed(2)}</td>
            <td>
                <input type="number" class="buyprice-input" data-symbol="${stock.symbol}" 
                       value="${stock.buyPrice.toFixed(2)}" step="0.01" min="0">
            </td>
            <td class="${stock.returnPercent >= 0 ? 'positive-return' : 'negative-return'}">${stock.returnPercent.toFixed(2)}%</td>
            <td>
                <input type="number" class="stoploss-input" data-symbol="${stock.symbol}" 
                       value="${stock.stoplossPrice.toFixed(2)}" step="0.01" min="0">
            </td>
            <td class="${stock.stoplossDiff >= 0 ? 'positive-return' : 'negative-return'}">${stock.stoplossDiff.toFixed(2)}%</td>
            <td>${formattedDate}</td>
            <td class="actions-cell">
                <button class="remove-stock-btn" data-symbol="${stock.symbol}">Remove</button>
                <button class="chart-btn" onclick="showFullScreenChart('${stock.symbol}')">Chart</button>
                <div class="pattern-container">
                    <div class="candle-pattern-tooltip">
                        <span class="candle-pattern ${singlePatternClass}">${patternAnalysis.single.pattern}</span>
                        <span class="tooltip-text">${patternAnalysis.single.description}</span>
                    </div>
                    <div class="candle-pattern-tooltip">
                        <span class="candle-pattern ${multiPatternClass}">${patternAnalysis.multi.pattern} ${directionIndicator}</span>
                        <span class="tooltip-text">
                            ${patternAnalysis.multi.description}
                            ${patternAnalysis.multi.details ? `<br>${patternAnalysis.multi.details}` : ''}
                            ${patternAnalysis.trend ? `<br>Current trend: ${patternAnalysis.trend}` : ''}
                            ${patternAnalysis.direction ? 
                              `<br>Predicted direction: ${patternAnalysis.direction === 'up' ? 'Upward ↑' : 
                                patternAnalysis.direction === 'down' ? 'Downward ↓' : 'Sideways →'}
                               ${(patternAnalysis.trend === 'uptrend' && patternAnalysis.direction === 'down') || 
                                 (patternAnalysis.trend === 'downtrend' && patternAnalysis.direction === 'up') ? 
                                '<br><strong>Note:</strong> Possible trend reversal signal' : ''}` : ''}
                        </span>
                    </div>
                </div>
            </td>
            <td class="chart-cell">
                <div id="chart-container-${stock.symbol}" class="chart-container-small"></div>
            </td>
        `;
        
        // Find the actions cell to add the watchlist button
        const actionsCell = row.querySelector('.actions-cell');
        
        if (actionsCell) {
            // Create watchlist button using the common function or directly
            let watchlistBtn;
            if (typeof window.createWatchlistButton === 'function') {
                watchlistBtn = window.createWatchlistButton(stock.symbol);
            } else {
                watchlistBtn = document.createElement('button');
                watchlistBtn.className = 'watchlist-btn';
                watchlistBtn.setAttribute('data-watchlist', stock.symbol);
                watchlistBtn.textContent = '☆';
                watchlistBtn.title = 'Add to Watchlist';
                
                // Add click event listener
                watchlistBtn.addEventListener('click', function() {
                    if (typeof window.toggleWatchlist === 'function') {
                        window.toggleWatchlist(stock.symbol);
                    }
                });
            }
            
            // Insert the button at the beginning of the actions cell
            actionsCell.insertBefore(watchlistBtn, actionsCell.firstChild);
        }
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners for stoploss input
    document.querySelectorAll('.stoploss-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const symbol = e.target.dataset.symbol;
            const newStoplossPrice = parseFloat(e.target.value);
            updateStoplossPrice(symbol, newStoplossPrice);
        });
    });
    
    // Add event listeners for buy price input
    document.querySelectorAll('.buyprice-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const symbol = e.target.dataset.symbol;
            const newBuyPrice = parseFloat(e.target.value);
            updateBuyPrice(symbol, newBuyPrice);
        });
    });
    
    document.querySelectorAll('.remove-stock-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const symbol = e.target.dataset.symbol;
            removeStockFromBought(symbol);
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
    
    // Initialize watchlist buttons after creating the table
    if (typeof window.initWatchlist === 'function') {
        window.initWatchlist();
    }
    
    // Initialize charts after rows are created
    setTimeout(() => {
        stoplossStocks.forEach(stock => {
            initializeStockChart(stock.symbol, stock.stoplossPrice, stock.buyPrice);
        });
    }, 100);
}

function updateStoplossPrice(symbol, newStoplossPrice) {
    // Update in boughtStocks
    const stockIndex = boughtStocks.findIndex(stock => stock.symbol === symbol);
    if (stockIndex !== -1) {
        // Keep track of existing properties
        const updatedStock = {
            ...boughtStocks[stockIndex],
            stoplossPrice: newStoplossPrice,
            manuallyUpdated: true  // Mark as manually updated so it won't be auto-recalculated
        };
        
        boughtStocks[stockIndex] = updatedStock;
        localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
        
        // Update in current display
        processStoplossStocks();
        
        showSuccess(`Updated stoploss for ${symbol} to ${newStoplossPrice.toFixed(2)}`);
    }
}

function updateBuyPrice(symbol, newBuyPrice) {
    // Update in boughtStocks
    const stockIndex = boughtStocks.findIndex(stock => stock.symbol === symbol);
    if (stockIndex !== -1) {
        boughtStocks[stockIndex].buyPrice = newBuyPrice;
        localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
        
        // Update in current display
        processStoplossStocks();
        
        showSuccess(`Updated buy price for ${symbol} to ${newBuyPrice.toFixed(2)}`);
    }
}

function removeStockFromBought(symbol) {
    // Remove from boughtStocks
    const stockIndex = boughtStocks.findIndex(stock => stock.symbol === symbol);
    if (stockIndex !== -1) {
        const removedStock = boughtStocks.splice(stockIndex, 1)[0];
        localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
        
        // Update in current display
        processStoplossStocks();
        
        showSuccess(`Removed ${symbol} from bought stocks`);
    }
}

// Function to downsample data points - keeps visual accuracy while reducing points
function downsampleData(data, threshold = 500) {
    if (data.length <= threshold) return data;
    
    // Simple method: take every nth item
    const n = Math.ceil(data.length / threshold);
    return data.filter((_, i) => i % n === 0);
}

// Initialize chart for a specific stock
function initializeStockChart(symbol, stoplossPrice, buyPrice) {
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
    
    // Y scale - ensure stoploss and buy price are included in the domain
    const minY = Math.min(
        d3.min(displayData, d => d.low) * 0.99,
        stoplossPrice * 0.99
    );
    const maxY = Math.max(
        d3.max(displayData, d => d.high) * 1.01,
        buyPrice * 1.01
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
    
    // Add stoploss price line
    svg.append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", y(stoplossPrice))
        .attr("y2", y(stoplossPrice))
        .attr("stroke", "#f44336")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "3,3");
    
    // Add buy price line
    svg.append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", y(buyPrice))
        .attr("y2", y(buyPrice))
        .attr("stroke", "#ff9800")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "3,3");
    
    // Add invisible rect for mouse tracking
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("click", () => {
            showFullScreenChart(symbol, stoplossPrice, buyPrice);
        });
    
    // Store chart instance reference
    chartInstances[symbol] = {
        chart: svg.node(),
        container: chartContainer
    };
}

// Show full screen chart popup
function showFullScreenChart(symbol, stoplossPrice, buyPrice) {
    console.log(`Showing full screen D3 chart for ${symbol}`);
    
    const popupContainer = document.querySelector('.chart-popup');
    const popupChartContainer = document.getElementById('popupChartContainer');
    const popupTitle = document.getElementById('popupChartTitle');
    
    if (!popupContainer || !popupChartContainer) {
        createChartPopup();
        return showFullScreenChart(symbol, stoplossPrice, buyPrice);
    }
    
    // Clear existing chart
    popupChartContainer.innerHTML = '';
    
    // Find the stock data
    const stockData = stoplossStocks.find(stock => stock.symbol === symbol);
    if (!stockData) return;
    
    // Use the provided stoploss and buy price or get them from stockData
    stoplossPrice = stoplossPrice || stockData.stoplossPrice;
    buyPrice = buyPrice || stockData.buyPrice;
    
    // Get the detailed candle pattern analysis
    const patternAnalysis = analyzeCandlePatterns(symbol);
    
    // Set pattern classes
    let singlePatternClass = 'neutral';
    if (patternAnalysis.single.bullish === true) {
        singlePatternClass = 'bullish';
    } else if (patternAnalysis.single.bullish === false) {
        singlePatternClass = 'bearish';
    }
    
    let multiPatternClass = 'neutral';
    if (patternAnalysis.multi.bullish === true) {
        multiPatternClass = 'bullish';
    } else if (patternAnalysis.multi.bullish === false) {
        multiPatternClass = 'bearish';
    }
    
    // Direction indicator
    const directionIndicator = patternAnalysis.direction === 'up' ? '↑' : 
                              patternAnalysis.direction === 'down' ? '↓' : 
                              '→';
    
    // Set popup title with comprehensive pattern information
    if (popupTitle) {
        popupTitle.innerHTML = `
            ${symbol} Chart 
            <div class="pattern-details">
                <span class="candle-pattern ${singlePatternClass}">
                    ${patternAnalysis.single.pattern}
                    <span class="tooltip-text">${patternAnalysis.single.description}</span>
                </span>
                <span class="candle-pattern ${multiPatternClass}">
                    ${patternAnalysis.multi.pattern} ${directionIndicator}
                    <span class="tooltip-text">
                        ${patternAnalysis.multi.description}
                        ${patternAnalysis.multi.details ? `<br>${patternAnalysis.multi.details}` : ''}
                        ${patternAnalysis.trend ? `<br>Current trend: ${patternAnalysis.trend}` : ''}
                        ${patternAnalysis.direction ? 
                          `<br>Predicted direction: ${patternAnalysis.direction === 'up' ? 'Upward ↑' : 
                            patternAnalysis.direction === 'down' ? 'Downward ↓' : 'Sideways →'}
                           ${(patternAnalysis.trend === 'uptrend' && patternAnalysis.direction === 'down') || 
                             (patternAnalysis.trend === 'downtrend' && patternAnalysis.direction === 'up') ? 
                            '<br><strong>Note:</strong> Possible trend reversal signal' : ''}` : ''}
                    </span>
                </span>
            </div>
        `;
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
        
        // Y scale - ensure stoploss and buy price are included in the domain
        const minY = Math.min(
            d3.min(displayData, d => d.low) * 0.99,
            stoplossPrice * 0.99
        );
        const maxY = Math.max(
            d3.max(displayData, d => d.high) * 1.01,
            buyPrice * 1.01
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
        
        // Add stoploss price line
        svg.append("line")
            .attr("x1", margin.left)
            .attr("x2", width - margin.right)
            .attr("y1", y(stoplossPrice))
            .attr("y2", y(stoplossPrice))
            .attr("stroke", "#f44336")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5");
        
        // Add stoploss price label
        svg.append("text")
            .attr("x", width - margin.right + 5)
            .attr("y", y(stoplossPrice) + 4)
            .attr("fill", "#f44336")
            .attr("font-size", "12px")
            .attr("text-anchor", "start")
            .text(`Stoploss: ${stoplossPrice.toFixed(2)}`);
        
        // Add buy price line
        svg.append("line")
            .attr("x1", margin.left)
            .attr("x2", width - margin.right)
            .attr("y1", y(buyPrice))
            .attr("y2", y(buyPrice))
            .attr("stroke", "#ff9800")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5");
        
        // Add buy price label
        svg.append("text")
            .attr("x", width - margin.right + 5)
            .attr("y", y(buyPrice) + 4)
            .attr("fill", "#ff9800")
            .attr("font-size", "12px")
            .attr("text-anchor", "start")
            .text(`Buy: ${buyPrice.toFixed(2)}`);
        
        // Add trend direction indication
        if (patternAnalysis.direction) {
            const directionColor = patternAnalysis.direction === 'up' ? '#4caf50' : 
                                    patternAnalysis.direction === 'down' ? '#f44336' : 
                                    '#ff9800';
            
            const directionText = patternAnalysis.direction === 'up' ? '↑ Bullish' : 
                                    patternAnalysis.direction === 'down' ? '↓ Bearish' : 
                                    '→ Neutral';
            
            // Check for potential conflict between trend and current pattern
            const hasTrendConflict = 
                (patternAnalysis.trend === 'uptrend' && patternAnalysis.direction === 'down') || 
                (patternAnalysis.trend === 'downtrend' && patternAnalysis.direction === 'up');
            
            let displayText = directionText;
            if (hasTrendConflict) {
                displayText += ` (Potential Reversal from ${patternAnalysis.trend})`;
            } else if (patternAnalysis.trend) {
                displayText += ` (Confirming ${patternAnalysis.trend})`;
            }
            
            svg.append("text")
                .attr("x", width - margin.right + 5)
                .attr("y", margin.top + 20)
                .attr("fill", directionColor)
                .attr("font-size", "14px")
                .attr("font-weight", "bold")
                .attr("text-anchor", "start")
                .text(displayText);
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
            close: parseFloat(item.close),
            date: item.date || null
        });
    });
    
    // Sort data by date if available
    Object.keys(stockHistoricalData).forEach(symbol => {
        if (stockHistoricalData[symbol].length > 0 && stockHistoricalData[symbol][0].date) {
            stockHistoricalData[symbol].sort((a, b) => {
                return new Date(a.date) - new Date(b.date);
            });
        }
    });
    
    // Log the number of symbols with data
    console.log(`Processed historical data for ${Object.keys(stockHistoricalData).length} symbols`);
    
    // Display candle patterns for stocks in the stoploss list
    if (stoplossStocks && stoplossStocks.length > 0) {
        stoplossStocks.forEach(stock => {
            const patternAnalysis = analyzeCandlePatterns(stock.symbol);
            if (patternAnalysis && patternAnalysis.multi) {
                console.log(`${stock.symbol} pattern analysis:`, 
                    `Single day: ${patternAnalysis.single.pattern} (${patternAnalysis.single.bullish ? 'Bullish' : patternAnalysis.single.bullish === false ? 'Bearish' : 'Neutral'})`,
                    `Multi-day: ${patternAnalysis.multi.pattern} (${patternAnalysis.multi.bullish ? 'Bullish' : patternAnalysis.multi.bullish === false ? 'Bearish' : 'Neutral'})`,
                    `Trend: ${patternAnalysis.trend || 'Unknown'}`,
                    `Direction: ${patternAnalysis.direction || 'Unknown'}`
                );
            }
        });
    }
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

// Add toggleWatchlist function to use the common version
function toggleWatchlist(symbol) {
    // Check if this is already processing a watchlist toggle
    if (toggleWatchlist._isProcessing) {
        return;
    }
    
    // Use the common reference if available
    if (typeof window.commonToggleWatchlist === 'function') {
        try {
            // Set flag to prevent recursive calls
            toggleWatchlist._isProcessing = true;
            
            // Call the common function
            window.commonToggleWatchlist(symbol);
        } finally {
            // Always clear the flag
            toggleWatchlist._isProcessing = false;
        }
        return;
    }
    
    // Fallback implementation if needed
    console.warn('Common watchlist functions not available. Please include common-watchlist.js');
}

// Initialize the recursion protection flag
toggleWatchlist._isProcessing = false;

function loadStoplossData() {
    showLoading(true);
    
    // Load bought stocks first
    loadBoughtStocks();
    
    // Ensure default stoploss percent is set correctly
    const defaultStoplossInput = document.getElementById('defaultStoplossPercent');
    if (defaultStoplossInput) {
        const storedStoplossPercent = localStorage.getItem('defaultStoplossPercent');
        if (!storedStoplossPercent) {
            // If no stored value, set input to default and save to localStorage
            defaultStoplossInput.value = DEFAULT_STOPLOSS_PERCENT;
            localStorage.setItem('defaultStoplossPercent', DEFAULT_STOPLOSS_PERCENT.toString());
            console.log(`Set default stoploss percent to ${DEFAULT_STOPLOSS_PERCENT}%`);
        } else {
            defaultStoplossInput.value = storedStoplossPercent;
            console.log(`Using saved stoploss percent: ${storedStoplossPercent}%`);
        }
    }
    
    // Validate stoploss prices for all stocks
    console.log("Validating stoploss prices for all stocks...");
    const defaultStoplossPercent = parseInt(defaultStoplossInput.value) || DEFAULT_STOPLOSS_PERCENT;
    console.log(`Default stoploss percent: ${defaultStoplossPercent}%`);
    
    // Fix any missing or invalid stoploss prices and add tracking properties to all stocks
    let fixedCount = 0;
    const updatedStocks = boughtStocks.map(stock => {
        let updatedStock = {...stock};
        
        // Add tracking properties if they're missing
        if (!('stoplossPercentUsed' in updatedStock)) {
            // Calculate what percentage was used for the current stoploss
            if (updatedStock.stoplossPrice && updatedStock.buyPrice) {
                const calculatedPercent = ((updatedStock.buyPrice - updatedStock.stoplossPrice) / updatedStock.buyPrice) * 100;
                updatedStock.stoplossPercentUsed = Math.round(calculatedPercent);
            } else {
                updatedStock.stoplossPercentUsed = defaultStoplossPercent;
            }
        }
        
        // For dashboard-added stocks without special flags, set them to auto-update by default
        if (!('importedViaExcel' in updatedStock) && !('manuallyUpdated' in updatedStock) && !('autoUpdateStoploss' in updatedStock)) {
            updatedStock.autoUpdateStoploss = true;
        }
        
        // Make sure the stoploss price is valid
        if (!updatedStock.stoplossPrice || isNaN(parseFloat(updatedStock.stoplossPrice)) || parseFloat(updatedStock.stoplossPrice) <= 0) {
            console.log(`Fixing missing stoploss price for ${updatedStock.symbol}`);
            fixedCount++;
            updatedStock.stoplossPrice = parseFloat((updatedStock.buyPrice * (1 - defaultStoplossPercent / 100)).toFixed(2));
            updatedStock.stoplossPercentUsed = defaultStoplossPercent;
            updatedStock.autoUpdateStoploss = true;
        }
        
        return updatedStock;
    });
    
    if (fixedCount > 0 || JSON.stringify(updatedStocks) !== JSON.stringify(boughtStocks)) {
        console.log(`Fixed ${fixedCount} stocks with missing or invalid stoploss prices and added tracking properties`);
        boughtStocks = updatedStocks;
        localStorage.setItem('boughtStocks', JSON.stringify(boughtStocks));
    }
    
    // Fetch current prices and then process stoploss stocks
    fetchCurrentPrices().then(() => {
        processStoplossStocks();
        
        // Show success message if stocks are found
        if (stoplossStocks.length > 0) {
            const watchlistParameter = new URLSearchParams(window.location.search).get('from_watchlist');
            if (watchlistParameter === 'true') {
                showSuccess(`Displaying ${stoplossStocks.length} stocks from your watchlist`);
            }
        } else if (boughtStocks.length === 0) {
            showError('No stocks found in Stoploss Tracker. Add stocks from Dashboard → Watchlist → Generate Order Code');
        }
        
        // Ensure watchlist is initialized after processing stocks
        if (typeof window.initWatchlist === 'function') {
            setTimeout(() => window.initWatchlist(), 100);
        }
        
        showLoading(false);
    }).catch(error => {
        console.error('Error loading stoploss data:', error);
        showError('Failed to load stoploss data');
        showLoading(false);
    });
}

function loadCurrentPrices() {
    return fetchCurrentPrices();
} 
