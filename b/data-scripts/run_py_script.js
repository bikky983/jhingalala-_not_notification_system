const { exec } = require('child_process');
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');

// Function to run the Python script
function runPythonScript() {
  console.log(`Running 1.5yr.py at ${new Date().toLocaleString()}`);
  
  // Path to the Python script
  const scriptPath = path.join(__dirname, '1.5yr.py');
  
  // Check if the script exists
  if (!fs.existsSync(scriptPath)) {
    console.error(`Error: Python script not found at ${scriptPath}`);
    return;
  }
  
  // Command to run the Python script
  const command = 'python "' + scriptPath + '"';
  
  // Run the command
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing Python script: ${error.message}`);
      return;
    }
    
    if (stderr) {
      console.error(`Python script stderr: ${stderr}`);
    }
    
    console.log(`Python script output: ${stdout}`);
    console.log('Python script execution completed successfully.');
  });
}

// Function to schedule the task at 3:15 PM Nepal time
function scheduleTask() {
  // Nepal is UTC+5:45
  const rule = new schedule.RecurrenceRule();
  rule.hour = 15; // 3 PM
  rule.minute = 15; // 15 minutes
  rule.tz = 'Asia/Kathmandu';
  
  console.log('Task scheduled to run 1.5yr.py at 3:15 PM Nepal time daily');
  
  schedule.scheduleJob(rule, function() {
    console.log(`Running scheduled task at ${new Date().toLocaleString()}`);
    runPythonScript();
  });
}

// If run directly, execute the function based on arguments
if (require.main === module) {
  // Check if test mode or scheduled mode
  const args = process.argv.slice(2);
  if (args.includes('--now')) {
    runPythonScript();
  } else {
    scheduleTask();
    console.log('Script is running in scheduled mode. Use --now flag to run immediately.');
  }
}

module.exports = {
  runPythonScript,
  scheduleTask
}; 
