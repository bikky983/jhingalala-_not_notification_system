// Common navigation component for all pages
document.addEventListener('DOMContentLoaded', function() {
    const navContainer = document.querySelector('.nav-links');
    
    if (navContainer) {
        // Define all pages in the application
        // New pages should be added at the end of this array
        const allPages = [
            { name: 'Dashboard', url: 'dashboard.html' },
            { name: 'Support Stocks', url: 'support-stocks.html' },
            { name: 'RSI + Support', url: 'rsi-support.html' },
            { name: 'Support Prediction', url: 'support-prediction.html' },
            { name: 'Stoploss Tracker', url: 'stoploss.html' },
            { name: 'Consolidation Scanner', url: 'consolidation-scanner.html' },
            { name: 'Consolidation Analyzer', url: 'consolidation-analyzer.html' },
            { name: 'Enhanced Trendline Scanner', url: 'enhanced-trendline-scanner.html' },
            { name: 'Institutional Activity', url: 'institutional-activity.html' },
            { name: 'Big Player Accumulation', url: 'big-player-accumulation.html' },
            { name: 'IPO Automation', url: 'ipo-automation.html' }
            // New pages should be added here
        ];
        
        // Get current page filename
        const currentPage = window.location.pathname.split('/').pop();
        
        // Clear existing navigation links
        navContainer.innerHTML = '';
        
        // Generate navigation links
        allPages.forEach(page => {
            const link = document.createElement('a');
            link.href = page.url;
            link.textContent = page.name;
            
            // Set active class for current page
            if (currentPage === page.url) {
                link.classList.add('active');
            }
            
            navContainer.appendChild(link);
        });
    }
}); 