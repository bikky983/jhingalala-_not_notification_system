/**
 * Main Notification Sender
 * This script processes all stock notifications and sends emails
 */
require('dotenv').config();
const path = require('path');
const schedule = require('node-schedule');
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
 * Process all notification types and send combined email
 */
async function processAndSendNotifications() {
    try {
        console.log('Starting notification process...');
        
        // Initialize state manager
        await stateManager.initialize();
        
        // Process each type of notification
        const results = {
            timestamp: new Date().toISOString()
        };
        
        // Process notifications with better error handling
        const processModule = async (name, module) => {
            try {
                console.log(`Processing ${name} notifications...`);
                return await module.process();
            } catch (error) {
                console.error(`Error processing ${name}:`, error);
                
                // Log the error and skip this notification
                console.log(`Skipping ${name} notifications due to error`);
                return null;
            }
        };
        
        // Add institutional activity notifications
        results.institutionalActivity = await processModule('institutionalActivity', institutionalActivity);
        
        // Add trendline scanner notifications
        results.trendlineScanner = await processModule('trendlineScanner', trendlineScanner);
        
        // Add weekly heatmap notifications
        results.weeklyHeatmap = await processModule('weeklyHeatmap', weeklyHeatmap);
        
        // Add RSI support notifications
        results.rsiSupport = await processModule('rsiSupport', rsiSupport);
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