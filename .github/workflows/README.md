# GitHub Actions Workflow for NEPSE Data Processing

This GitHub Actions workflow automatically runs the data processing scripts at scheduled times to handle NEPSE (Nepal Stock Exchange) data.

## What This Workflow Does

1. Runs automatically at 3:10 PM Nepal time (UTC+5:45) on weekdays (Sunday to Friday)
2. Can also be triggered manually through the GitHub Actions interface
3. Sets up the necessary Node.js and Python environments
4. Installs all required dependencies
5. Executes the data-scripts/scheduler.js script that:
   - Downloads the latest NEPSE data
   - Processes the data using the Python script

## Manual Triggering

You can manually trigger this workflow by:

1. Going to the "Actions" tab in your GitHub repository
2. Selecting "NEPSE Data Processing Scheduler" from the workflows list
3. Clicking "Run workflow" and then "Run workflow" again to confirm

## Workflow Details

- **Schedule**: Runs at 9:25 AM UTC (3:10 PM Nepal time) Sunday-Friday
- **Node.js version**: 16.x
- **Python version**: 3.9

## Troubleshooting

If the workflow fails, check the following:

1. Ensure all dependencies are correctly listed in the workflow file
2. Check the logs in the GitHub Actions tab to see what error occurred
3. Make sure your repository has the necessary permissions to run GitHub Actions

## Modifying the Schedule

To change when the workflow runs, edit the cron expression in `.github/workflows/data-script-scheduler.yml`:

```yaml
on:
  schedule:
    - cron: '25 9 * * 0-5'  # Format: minute hour day_of_month month day_of_week
``` 