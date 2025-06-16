# NEPSE Stock Screener with Email Notifications

This application provides a comprehensive NEPSE stock screening platform with automated email notifications based on customized criteria.

## Features

- **Web Interface**: View stock data on a responsive web dashboard
- **Institutional Activity Monitoring**: Get notifications about stocks with high institutional scores
- **Enhanced Trendline Scanner**: Track stocks in uptrends and get notified of new trends
- **Weekly Heatmap**: Monitor top volume stocks by sector
- **RSI Support Analysis**: Find stocks near support levels with favorable RSI readings
- **Email Notifications**: Receive daily email notifications for stocks meeting your criteria

## Setup Instructions

1. **Install Dependencies**:
   ```
   npm install
   ```

2. **Configure Email Notifications**:
   
   Create a `.env` file with the following variables:
   ```
   # Email Configuration
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   EMAIL_FROM=your-email@gmail.com
   EMAIL_RECIPIENTS=recipient1@example.com,recipient2@example.com

   # Notification Schedule (cron format)
   NOTIFICATION_CRON=0 8 * * * 
   ```

   Note: For Gmail, you need to use an App Password:
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification
   - Create an App Password under "App passwords"
   - Use that password in the EMAIL_PASSWORD field

3. **Customize Notification Criteria**:
   
   Edit `server/notifications/config/config.js` to adjust thresholds and criteria

## Running the Application

1. **Start Web Server**:
   ```
   npm start
   ```

2. **Run Immediate Notifications Test**:
   ```
   npm run notify -- --now
   ```

3. **Schedule Daily Notifications**:
   ```
   npm run notify
   ```

## Notification Types

### Institutional Activity Notifications
Stocks are categorized by institutional activity scores (0.5, 0.65, 0.8) with detailed metrics.

### Enhanced Trendline Scanner Notifications
Identifies stocks in uptrends and differentiates between new and existing uptrend stocks.

### Weekly Heatmap Notifications
Shows top 3 highest volume stocks from each sector with details on price changes and support levels.

### RSI Support Notifications
Identifies stocks near support levels with favorable RSI readings for potential buy opportunities.

## Folder Structure

- `/public` - Frontend assets and HTML files
- `/server` - Backend server and API routes
  - `/notifications` - Email notification system
    - `/config` - Configuration files
    - `/modules` - Notification criteria modules
    - `/templates` - Email templates
    - `/utils` - Utility functions
    - `/data` - Storage for notification state
- `/data-scripts` - Scripts for fetching and processing stock data
