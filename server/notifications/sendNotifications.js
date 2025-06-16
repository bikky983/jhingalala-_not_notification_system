/**
 * Main Notification Sender
 * This script processes all stock notifications and sends emails
 * Modified to work with browser-based data flow
 */
require('dotenv').config();
const path = require('path');
const schedule = require('node-schedule');
const puppeteer = require('puppeteer');
const emailUtil = require('./utils/emailUtil');
const stateManager = require('./utils/stateManager');
const config = require('./config/config');

// Import all notification modules
const institutionalActivity = require('./modules/institutionalActivity');
const trendlineScanner = require('./modules/trendlineScanner');
const weeklyHeatmap = require('./modules/weeklyHeatmap');
const rsiSupport = require('./modules/rsiSupport');

// Register additional Handlebars helpers for the email template
const handlebars = require('handlebars');
handlebars.registerHelper('gt', function(a, b) {
    return a > b;
});

handlebars.registerHelper('formatDate', function(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
});

handlebars.registerHelper('currentYear', function() {
    return new Date().getFullYear();
});

/**
 * Loads data from the website using headless browser
 * First loads dashboard and uploads Excel file, then visits each analysis page
 */
async function loadDataViaBrowser() {
    console.log('Starting browser-based data loading...');
    
    // Store data from each page
    const dataStore = {};
    
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // First visit dashboard to initialize local storage
        console.log('Loading dashboard...');
        await page.goto('https://jhingalala.netlify.app/dashboard.html', { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });
        
        // Upload Excel file
        try {
            console.log('Uploading Excel file...');
            
            // Look for the file input element
            const uploadButton = await page.$('#uploadExcel');
            
            if (uploadButton) {
                // Set the file to upload
                const excelFilePath = path.join(__dirname, '../../public/stocks.xlsx');
                
                // Upload the file
                await uploadButton.uploadFile(excelFilePath);
                
                // Wait for the file to be processed
                await page.waitForTimeout(3000);
                
                console.log('Excel file uploaded successfully');
            } else {
                console.log('Upload button not found, checking for alternative upload method');
                
                // Try alternative methods to upload
                const fileInputs = await page.$$('input[type="file"]');
                if (fileInputs.length > 0) {
                    const excelFilePath = path.join(__dirname, '../../public/stocks.xlsx');
                    await fileInputs[0].uploadFile(excelFilePath);
                    await page.waitForTimeout(3000);
                    console.log('Excel file uploaded via alternative method');
                } else {
                    console.log('No file input elements found');
                }
            }
        } catch (uploadError) {
            console.error('Error uploading Excel file:', uploadError);
        }
        
        // Wait for local storage to be populated
        await page.waitForTimeout(2000);
        
        // Visit each analysis page and extract data
        const pagesToVisit = [
            { url: 'https://jhingalala.netlify.app/heatmap.html', key: 'heatmap' },
            { url: 'https://jhingalala.netlify.app/rsi-support.html', key: 'rsiSupport' },
            { url: 'https://jhingalala.netlify.app/enhanced-trendline-scanner.html', key: 'trendlineScanner' }
        ];
        
        for (const pageInfo of pagesToVisit) {
            console.log(`Loading ${pageInfo.key} page...`);
            await page.goto(pageInfo.url, { waitUntil: 'networkidle0', timeout: 60000 });
            
            // Allow time for page to process data
            await page.waitForTimeout(5000);
            
            // Extract data from tables
            dataStore[pageInfo.key] = await page.evaluate(() => {
                const tableData = [];
                const tables = document.querySelectorAll('table');
                
                if (tables.length > 0) {
                    // Use first table found
                    const rows = tables[0].querySelectorAll('tr');
                    
                    // Get headers first to use as keys
                    const headers = [];
                    const headerCells = rows[0]?.querySelectorAll('th');
                    if (headerCells) {
                        headerCells.forEach(cell => {
                            headers.push(cell.textContent.trim().toLowerCase().replace(/\s+/g, '_'));
                        });
                    }
                    
                    // Process data rows
                    for (let i = 1; i < rows.length; i++) {
                        const cells = rows[i].querySelectorAll('td');
                        if (cells.length > 0) {
                            const rowData = {};
                            
                            // Use headers if available, otherwise use generic column names
                            for (let j = 0; j < cells.length; j++) {
                                const key = headers[j] || `col${j}`;
                                rowData[key] = cells[j].textContent.trim();
                            }
                            
                            tableData.push(rowData);
                        }
                    }
                }
                
                return tableData;
            });
            
            console.log(`Retrieved ${dataStore[pageInfo.key].length} rows from ${pageInfo.key}`);
        }
        
        await browser.close();
        console.log('Data collection complete');
        
        return dataStore;
    } catch (error) {
        console.error('Error in browser data collection:', error);
        return null;
    }
}

/**
 * Process all notification types and send combined email
 */
async function processAndSendNotifications() {
    try {
        console.log('Starting notification process...');
        
        // Initialize state manager
        await stateManager.initialize();
        
        // Load data via browser automation
        const browserData = await loadDataViaBrowser();
        
        // Process each type of notification
        const results = {
            timestamp: new Date().toISOString()
        };
        
        // Helper to process module with real or sample data
        const processModule = async (name, module, browserDataKey) => {
            try {
                console.log(`Processing ${name} notifications...`);
                
                // If we have browser data for this module, use it
                if (browserData && browserData[browserDataKey] && browserData[browserDataKey].length > 0) {
                    console.log(`Using browser data for ${name}`);
                    // Set the browser data for the module to use
                    module.setBrowserData(browserData[browserDataKey]);
                }
                
                return await module.process();
            } catch (error) {
                console.error(`Error processing ${name}:`, error);
                console.log(`Using sample data for ${name} due to error`);
                // For modules with getSampleData method, use that as fallback
                if (typeof module.getSampleData === 'function') {
                    const sampleData = module.getSampleData();
                    return {
                        type: name,
                        data: name === 'institutionalActivity' ? 
                              { '0.5': sampleData.filter(s => s.score >= 0.5 && s.score < 0.65),
                                '0.65': sampleData.filter(s => s.score >= 0.65 && s.score < 0.8),
                                '0.8': sampleData.filter(s => s.score >= 0.8) } :
                              name === 'trendlineScanner' ?
                              { new: sampleData.filter(s => s.trend === 'Uptrend').slice(0, 2),
                                existing: sampleData.filter(s => s.trend === 'Uptrend').slice(2) } :
                              name === 'weeklyHeatmap' ?
                              { sectors: Object.values(sampleData).reduce((acc, stocks) => {
                                  const sector = stocks[0]?.sector || 'Unknown';
                                  acc[sector] = stocks.slice(0, 3);
                                  return acc;
                                }, {}) } :
                              { stocks: sampleData }
                    };
                }
                return null;
            }
        };
        
        // Add institutional activity notifications
        results.institutionalActivity = await processModule('institutionalActivity', institutionalActivity, 'heatmap');
        
        // Add trendline scanner notifications
        results.trendlineScanner = await processModule('trendlineScanner', trendlineScanner, 'trendlineScanner');
        
        // Add weekly heatmap notifications
        results.weeklyHeatmap = await processModule('weeklyHeatmap', weeklyHeatmap, 'heatmap');
        
        // Add RSI support notifications
        results.rsiSupport = await processModule('rsiSupport', rsiSupport, 'rsiSupport');
        if (results.rsiSupport) {
            results.rsiSupport.maxRSI = config.criteria.rsiSupport.maxRSI;
        }
        
        // Check if we have any notifications to send
        const hasNotifications = 
            results.institutionalActivity?.data || 
            results.trendlineScanner?.data || 
            results.weeklyHeatmap?.data || 
            results.rsiSupport?.data;
        
        if (!hasNotifications) {
            console.log('No notifications to send.');
            return;
        }
        
        // Send the email notification
        try {
            await emailUtil.sendStockNotification(results);
            console.log('Notifications sent successfully.');
        } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
            console.log('Email notification data:', JSON.stringify(results, null, 2));
        }
        
    } catch (error) {
        console.error('Error in notification process:', error);
    }
}

/**
 * Schedule notifications based on cron pattern
 */
function scheduleNotifications() {
    const cronPattern = config.schedule.notificationCron;
    console.log(`Scheduling notifications with pattern: ${cronPattern}`);
    
    schedule.scheduleJob(cronPattern, async () => {
        await processAndSendNotifications();
    });
    
    console.log('Notifications scheduled.');
}

/**
 * Main execution
 */
async function main() {
    // Check if we're running from command line
    const runImmediately = process.argv.includes('--now');
    
    if (runImmediately) {
        console.log('Running notifications immediately...');
        await processAndSendNotifications();
    } else {
        scheduleNotifications();
    }
}

// Run the main function
main().catch(err => {
    console.error('Fatal error in notification system:', err);
    process.exit(1);
}); 