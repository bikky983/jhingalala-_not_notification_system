const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Function to format date as mm/dd/yyyy
function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

async function downloadNepseData() {
  console.log('Starting download process...');
  const todayDate = formatDate(new Date());
  
  // Launch browser with headless mode for CI environment
  const browser = await puppeteer.launch({
    headless: 'new',  // Use new headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080'
    ],
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  try {
    // Open page
    const page = await browser.newPage();
    
    // Set user agent to mimic a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set download behavior
    const downloadPath = path.resolve('./data-scripts');
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });
    
    // Navigate to website with retry logic
    console.log('Navigating to website...');
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        await page.goto('https://nepalstock.com.np/today-price', { 
          waitUntil: 'networkidle2',
          timeout: 60000  // Increased timeout to 1 minutes
        });
        break;  // If successful, break the retry loop
      } catch (error) {
        retryCount++;
        console.log(`Attempt ${retryCount} failed: ${error.message}`);
        if (retryCount === maxRetries) {
          throw new Error(`Failed to connect after ${maxRetries} attempts: ${error.message}`);
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    // Wait for 10 seconds for page to load properly
    console.log('Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Enter date
    console.log(`Setting date to ${todayDate}...`);
    const dateInput = await page.$('input.ng-untouched.ng-pristine.ng-valid[type="text"]');
    if (!dateInput) {
      throw new Error('Could not find date input element');
    }
    
    await dateInput.click({ clickCount: 3 });
    await dateInput.type(todayDate);
    
    // Wait 5 seconds before clicking filter
    console.log('Waiting before clicking filter...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Click filter button
    console.log('Clicking filter button...');
    const filterButton = await page.$('button.box__filter--search[type="button"]');
    if (!filterButton) {
      throw new Error('Could not find filter button');
    }
    await filterButton.click();
    
    // Wait 10 seconds before clicking download
    console.log('Waiting before downloading...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Click download as CSV
    console.log('Clicking download as CSV...');
    const downloadButton = await page.$('a.table__file');
    if (!downloadButton) {
      throw new Error('Could not find download button');
    }
    await downloadButton.click();
    
    // Wait for download to complete
    console.log('Waiting for download to complete...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('Download completed successfully!');
    console.log(`CSV file should be saved in: ${downloadPath}`);
    
    // List files in the download directory to confirm
    try {
      const files = fs.readdirSync(downloadPath);
      const csvFiles = files.filter(file => file.endsWith('.csv'));
      console.log('CSV files in download directory:');
      csvFiles.forEach(file => console.log(` - ${file}`));
    } catch (err) {
      console.error('Error listing download directory:', err);
    }
    
  } catch (error) {
    console.error('Error during download process:', error);
    process.exit(1); // Exit with error code for GitHub Actions
  } finally {
    // Close browser
    await browser.close();
  }
}

// Run the download function
downloadNepseData(); 
