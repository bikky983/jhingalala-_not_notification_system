const { downloadNepseData, scheduleTask: scheduleDownloader } = require('./nepse_downloader');
const { runPythonScript, scheduleTask: schedulePyScript } = require('./run_py_script');
const schedule = require('node-schedule');

/**
 * Main scheduler that manages both the nepse_downloader.js and 1.5yr.py scripts
 * 
 * nepse_downloader.js - Downloads data at 3:10 PM Nepal time
 * 1.5yr.py - Processes data at 3:15 PM Nepal time (runs 5 minutes after downloader)
 */

// Function to schedule all tasks
function scheduleAllTasks() {
  console.log('Setting up all scheduled tasks...');
  
  // Schedule the downloader (3:10 PM Nepal time)
  scheduleDownloader();
  
  // Schedule the Python processor (3:15 PM Nepal time)
  schedulePyScript();
  
  console.log('All tasks have been scheduled successfully.');
  console.log('- NEPSE Downloader: runs at 3:10 PM Nepal time');
  console.log('- Data Processor: runs at 3:15 PM Nepal time');
}

// Function to run all tasks immediately (for testing)
async function runAllTasksNow() {
  console.log('Running all tasks immediately for testing...');
  
  try {
    // Run the downloader first
    console.log('Step 1: Running NEPSE Downloader...');
    await downloadNepseData();
    
    // Wait for 10 seconds before processing
    console.log('Waiting 10 seconds before processing data...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Run the Python processor
    console.log('Step 2: Running Data Processor...');
    runPythonScript();
    
    console.log('All tasks have been executed in sequence.');
  } catch (error) {
    console.error('Error running tasks:', error);
  }
}

// Parse command-line arguments
const args = process.argv.slice(2);
if (args.includes('--now')) {
  // Run all tasks immediately for testing
  runAllTasksNow();
} else if (args.includes('--download-only')) {
  // Run only the downloader immediately
  downloadNepseData();
} else if (args.includes('--process-only')) {
  // Run only the processor immediately
  runPythonScript();
} else {
  // Schedule all tasks to run at their specified times
  scheduleAllTasks();
  console.log('Scheduler is running. Use one of these flags for immediate execution:');
  console.log('  --now: Run all tasks in sequence');
  console.log('  --download-only: Run only the NEPSE downloader');
  console.log('  --process-only: Run only the data processor');
}

module.exports = {
  scheduleAllTasks,
  runAllTasksNow
}; 