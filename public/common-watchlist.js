/**
 * Common Watchlist functionality for all pages
 * Include this script in any page to add watchlist support
 */

// Check if a stock is in watchlist
function isInWatchlist(symbol) {
    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    const foundStock = userStocks.find(s => s.symbol === symbol);
    return foundStock && foundStock.watchlist;
}

// Toggle watchlist status for a stock
function toggleWatchlist(symbol) {
    // Get a fresh copy of userStocks from localStorage
    const userStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
    
    // Find the stock in the user's stocks
    const stockIndex = userStocks.findIndex(stock => stock.symbol === symbol);
    
    if (stockIndex !== -1) {
        // Stock exists, toggle watchlist property
        userStocks[stockIndex].watchlist = !userStocks[stockIndex].watchlist;
        const isWatchlisted = userStocks[stockIndex].watchlist;
        
        // Save changes
        localStorage.setItem('userStocks', JSON.stringify(userStocks));
        
        // Update UI
        document.querySelectorAll(`.watchlist-btn[data-watchlist="${symbol}"]`).forEach(btn => {
            btn.classList.toggle('active', isWatchlisted);
            btn.title = isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist';
            btn.textContent = isWatchlisted ? '★' : '☆';
            
            // Also update the row highlight
            const row = btn.closest('tr');
            if (row) {
                if (isWatchlisted) {
                    row.classList.add('watchlist-item');
                } else {
                    row.classList.remove('watchlist-item');
                }
            }
        });
        
        // Show feedback message if the function exists
        if (typeof showSuccess === 'function') {
            showSuccess(isWatchlisted ? 
                `${symbol} added to watchlist` : 
                `${symbol} removed from watchlist`);
        }
    } else {
        // Stock doesn't exist yet, add it with watchlist=true
        const newStock = {
            symbol,
            watchlist: true,
            addedAt: new Date().toISOString(),
            // Add default fields that dashboard expects
            folder: 'all',
            supportPrice1: null,
            supportPrice2: null,
            supportPrice3: null,
            upperLimit: null
        };
        
        userStocks.push(newStock);
        
        // Save updated watchlist
        localStorage.setItem('userStocks', JSON.stringify(userStocks));
        
        // Update UI
        document.querySelectorAll(`.watchlist-btn[data-watchlist="${symbol}"]`).forEach(btn => {
            btn.classList.add('active');
            btn.title = 'Remove from Watchlist';
            btn.textContent = '★';
            
            // Also update the row highlight
            const row = btn.closest('tr');
            if (row) {
                row.classList.add('watchlist-item');
            }
        });
        
        // Show feedback if the function exists
        if (typeof showSuccess === 'function') {
            showSuccess(`${symbol} added to watchlist`);
        }
    }
}

// Create a watchlist button element
function createWatchlistButton(symbol) {
    const isWatchlisted = isInWatchlist(symbol);
    const button = document.createElement('button');
    button.className = `action-btn watchlist-btn ${isWatchlisted ? 'active' : ''}`;
    button.setAttribute('data-watchlist', symbol);
    button.title = isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist';
    button.textContent = isWatchlisted ? '★' : '☆';
    button.addEventListener('click', () => toggleWatchlist(symbol));
    return button;
}

// Helper to add watchlist buttons to tables
function addWatchlistButtonsToTable(tableSelector, symbolColumnIndex = 0) {
    const table = document.querySelector(tableSelector);
    if (!table) {
        console.warn("Table not found:", tableSelector);
        return;
    }
    
    console.log(`Adding watchlist buttons to table ${tableSelector} with symbol column index ${symbolColumnIndex}`);
    
    // Get all rows in the table body
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) {
        console.log("No rows found in table:", tableSelector);
        return;
    }
    
    // Process each row
    rows.forEach(row => {
        // Skip placeholder or empty rows
        if (row.classList.contains('no-stocks') || row.classList.contains('no-data')) {
            return;
        }
        
        // Get the cells from the row
        const cells = row.querySelectorAll('td');
        
        // Check if the row has enough cells for the symbol column index
        if (cells.length <= symbolColumnIndex) {
            console.warn("Row doesn't have enough cells for symbol column index:", symbolColumnIndex, "Row has", cells.length, "cells");
            // Skip this row rather than causing an error
            return;
        }
        
        // Try to find the symbol in different ways
        let symbol = '';
        
        // First check if the row has a data-symbol attribute
        if (row.dataset.symbol) {
            symbol = row.dataset.symbol;
        } 
        // Next check if the symbol cell has a data-symbol attribute
        else if (cells[symbolColumnIndex].dataset.symbol) {
            symbol = cells[symbolColumnIndex].dataset.symbol;
        }
        // Finally try to get the text content
        else {
            symbol = cells[symbolColumnIndex].textContent.trim();
            
            // Remove any badges or extra content
            const tempElement = document.createElement('div');
            tempElement.innerHTML = symbol;
            
            // Extract just the text node content or first span that might contain the symbol
            const textNodes = Array.from(tempElement.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE || node.tagName === 'SPAN');
            
            if (textNodes.length > 0) {
                symbol = textNodes[0].textContent.trim();
            }
        }
        
        // Make sure we have a valid symbol
        if (!symbol) {
            console.warn("Could not extract symbol from row:", row);
            return;
        }
        
        // Check if this row already has a watchlist button for this symbol
        const existingBtn = row.querySelector(`button[data-watchlist="${symbol}"]`);
        if (existingBtn) {
            console.log("Row already has watchlist button for:", symbol);
            return;
        }
        
        // Look for an actions column or a column with buttons
        let actionCell = null;
        
        // Look through all cells for one with buttons or an "actions" class
        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            if (cell.querySelector('button') || 
                cell.classList.contains('actions') || 
                cell.classList.contains('action') ||
                cell.classList.contains('actions-cell')) {
                actionCell = cell;
                break;
            }
        }
        
        // If no action cell found, see if there's a cell with text like "Action" or "Actions"
        if (!actionCell) {
            const headerCells = table.querySelectorAll('thead th');
            let actionColumnIndex = -1;
            
            for (let i = 0; i < headerCells.length; i++) {
                const headerText = headerCells[i].textContent.trim().toLowerCase();
                if (headerText === 'action' || headerText === 'actions') {
                    actionColumnIndex = i;
                    break;
                }
            }
            
            if (actionColumnIndex >= 0 && actionColumnIndex < cells.length) {
                actionCell = cells[actionColumnIndex];
            }
        }
        
        // If still no action cell found, create one at the end
        if (!actionCell) {
            actionCell = document.createElement('td');
            actionCell.className = 'actions';
            row.appendChild(actionCell);
        }
        
        // Now add the watchlist button
        const watchlistBtn = createWatchlistButton(symbol);
        actionCell.appendChild(watchlistBtn);
        
        // Highlight row if in watchlist
        if (isInWatchlist(symbol)) {
            row.classList.add('watchlist-item');
        }
    });
}

// Initialize watchlist functionality on a page
function initWatchlist() {
    console.log("Initializing watchlist functionality");
    
    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupWatchlistFunctionality);
    } else {
        setupWatchlistFunctionality();
    }
}

function setupWatchlistFunctionality() {
    console.log("Setting up watchlist functionality");
    
    // Add watchlist buttons to all stock tables on the page
    const tables = document.querySelectorAll('table');
    
    // Process each table
    tables.forEach(table => {
        // Skip tables without tbody
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        
        // Get the table ID or create a unique ID if none exists
        if (!table.id) {
            table.id = 'table_' + Math.random().toString(36).substr(2, 9);
        }
        
        console.log("Adding watchlist buttons to table:", table.id);
        
        // Find the index of the stock symbol column - usually the first cell with text
        let symbolColumnIndex = 0;
        const headerRow = table.querySelector('thead tr');
        
        if (headerRow) {
            const headerCells = headerRow.querySelectorAll('th');
            let found = false;
            
            // First try to find an exact match for "Symbol" or "Stock"
            for (let i = 0; i < headerCells.length; i++) {
                const cellText = headerCells[i].textContent.trim().toLowerCase();
                if (cellText === 'symbol' || cellText === 'stock') {
                    symbolColumnIndex = i;
                    found = true;
                    break;
                }
            }
            
            // If not found, try partial matches
            if (!found) {
                for (let i = 0; i < headerCells.length; i++) {
                    const cellText = headerCells[i].textContent.trim().toLowerCase();
                    if (cellText.includes('symbol') || cellText.includes('stock')) {
                        symbolColumnIndex = i;
                        found = true;
                        break;
                    }
                }
            }
        }
        
        // For safety, let's verify the symbol column by checking the first row
        const firstRow = tbody.querySelector('tr');
        if (firstRow) {
            const cells = firstRow.querySelectorAll('td');
            // If the identified column index is beyond the available cells, default to column 0
            if (cells.length <= symbolColumnIndex) {
                console.warn(`Symbol column index ${symbolColumnIndex} is beyond the number of cells (${cells.length}). Defaulting to column 0.`);
                symbolColumnIndex = 0;
            }
        }
        
        // Add watchlist buttons to this table
        try {
            addWatchlistButtonsToTable('#' + table.id, symbolColumnIndex);
        } catch (error) {
            console.error("Error adding watchlist buttons to table:", error);
        }
    });
    
    // Look for buttons with data-watchlist attribute that don't have event listeners
    document.querySelectorAll('button[data-watchlist]').forEach(btn => {
        // Skip if already has the watchlist-btn class (probably already setup)
        if (btn.classList.contains('watchlist-btn')) return;
        
        const symbol = btn.getAttribute('data-watchlist');
        if (!symbol) return;
        
        // Add the proper class and event listener
        btn.classList.add('watchlist-btn');
        btn.title = isInWatchlist(symbol) ? 'Remove from Watchlist' : 'Add to Watchlist';
        btn.textContent = isInWatchlist(symbol) ? '★' : '☆';
        
        // Remove existing click event (to avoid duplicates) by cloning the node
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        // Add the click event listener
        newBtn.addEventListener('click', () => toggleWatchlist(symbol));
    });
}

// Export functions for use in other scripts
window.isInWatchlist = isInWatchlist;
window.toggleWatchlist = toggleWatchlist;
window.createWatchlistButton = createWatchlistButton;
window.addWatchlistButtonsToTable = addWatchlistButtonsToTable;
window.initWatchlist = initWatchlist; 