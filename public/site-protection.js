/**
 * Website Protection Script
 * Prevents: Copying content, Opening console, Inspection, and keyboard shortcuts
 */

// Prevent right-click context menu
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
});

// Disable text selection/copying
document.addEventListener('selectstart', function(e) {
    e.preventDefault();
    return false;
});

// Prevent copying
document.addEventListener('copy', function(e) {
    e.preventDefault();
    return false;
});

// Prevent keyboard shortcuts (Ctrl+S, Ctrl+U, F12, etc.)
document.addEventListener('keydown', function(e) {
    // Prevent F12 key (Developer Tools)
    if (e.keyCode === 123) {
        e.preventDefault();
        return false;
    }
    
    // Prevent Ctrl+Shift+I (Chrome dev tools)
    if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
        e.preventDefault();
        return false;
    }
    
    // Prevent Ctrl+Shift+J (Chrome dev tools)
    if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
        e.preventDefault();
        return false;
    }
    
    // Prevent Ctrl+Shift+C (Chrome dev tools)
    if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
        e.preventDefault();
        return false;
    }
    
    // Prevent Ctrl+U (View Source)
    if (e.ctrlKey && e.keyCode === 85) {
        e.preventDefault();
        return false;
    }
    
    // Prevent Ctrl+S (Save page)
    if (e.ctrlKey && e.keyCode === 83) {
        e.preventDefault();
        return false;
    }
});

// Detect and disable console opening
(function() {
    let checkConsole = function() {
        let startTime = new Date();
        debugger;
        let endTime = new Date();
        
        if (endTime - startTime > 100) {
            document.body.innerHTML = '';
            document.body.style.background = '#ffffff';
            document.body.innerHTML = '<h1 style="text-align:center;margin-top:50px;">This website is protected</h1>';
        }
        
        setTimeout(checkConsole, 1000);
    };
    
    checkConsole();
})();

// Disable devtools in various ways
(function() {
    // Detect if devtools is open
    let isDevToolsOpen = function() {
        const threshold = 160;
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;
        
        return widthThreshold || heightThreshold;
    };
    
    // Check periodically
    setInterval(function() {
        if (isDevToolsOpen() || window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) {
            document.body.innerHTML = '';
            document.body.style.background = '#ffffff';
            document.body.innerHTML = '<h1 style="text-align:center;margin-top:50px;">This website is protected</h1>';
        }
    }, 1000);
    
    // Clear console messages
    setInterval(function() {
        console.clear();
        console.log('%c', 'padding: 1px; background: #fff; color: #fff; font-size: 1px;');
    }, 100);
    
    // Disable console methods
    const disableConsole = function() {
        let methods = ['log', 'debug', 'info', 'warn', 'error', 'assert', 'dir', 'dirxml', 'group', 
                      'groupEnd', 'time', 'timeEnd', 'count', 'trace', 'profile', 'profileEnd'];
        
        methods.forEach(function(method) {
            console[method] = function() {};
        });
    };
    
    disableConsole();
})(); 
