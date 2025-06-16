/**
 * Stock Notification System Configuration
 */
module.exports = {
    // Email configuration
    email: {
        service: 'gmail', // email service (gmail, outlook, etc)
        from: process.env.EMAIL_FROM || 'your-email@example.com',
        recipients: (process.env.EMAIL_RECIPIENTS || '').split(','),
        subjectPrefix: '[NEPSE Stock Alert] '
    },
    
    // Notification timing (in cron format)
    schedule: {
        // Default: Run daily at 8:00 AM
        notificationCron: process.env.NOTIFICATION_CRON || '0 8 * * *'
    },
    
    // Criteria thresholds
    criteria: {
        // Institutional score thresholds
        institutionalActivity: {
            thresholds: [0.5, 0.65, 0.8],
            minPercentChange: 1.0 // minimum percent change to be included
        },
        
        // Enhanced trendline criteria
        trendline: {
            minPercentChange: 2.0, // minimum percent change
            periodToCheck: 7 // days to check for new vs existing uptrends
        },
        
        // Heatmap volume criteria
        heatmap: {
            topNbyVolume: 3, // top N stocks by volume per sector
            minVolume: 100000 // minimum volume to be considered
        },
        
        // RSI support level criteria
        rsiSupport: {
            maxRSI: 40, // maximum RSI to be considered at support
            maxDistanceFromSupport: 5 // percentage from support level
        }
    },
    
    // Data storage paths
    storage: {
        previousAlerts: 'server/notifications/data/previous-alerts.json',
        dataPath: 'data-scripts/organized_nepse_data.json'
    }
}; 