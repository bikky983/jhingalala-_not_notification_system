import pandas as pd
import json
import os
import csv
import glob
from datetime import datetime, timedelta
from collections import defaultdict

# Function to process a single sheet or CSV file
def process_data(df, date_source="sheet_name", sheet_name=None):
    data = []
    
    # Check if "Business Date" column exists; if not, use sheet_name or a default date
    if "Business Date" in df.columns:
        date_col = "Business Date"
    else:
        if date_source == "sheet_name" and sheet_name:
            date = sheet_name
        else:
            date = "unknown_date"
        df["Business Date"] = date
        date_col = "Business Date"
    
    # Determine column names for OHLC data (support both formats)
    open_col = "Open Price" if "Open Price" in df.columns else "Open"
    high_col = "High Price" if "High Price" in df.columns else "High"
    low_col = "Low Price" if "Low Price" in df.columns else "Low"
    close_col = "Close Price" if "Close Price" in df.columns else "Close"
    volume_col = "Total Traded Quantity" if "Total Traded Quantity" in df.columns else None
    
    # Ensure required columns exist
    required_columns = ["Business Date", "Symbol", open_col, high_col, low_col, close_col]
    available_columns = [col for col in required_columns if col in df.columns]
    
    if len(available_columns) != len(required_columns):
        print(f"Missing required columns. Found: {available_columns}")
        return data
    
    # Extract the required columns and convert to list of dictionaries
    for _, row in df.iterrows():
        try:
            entry = {
                "time": str(row[date_col]).replace("-", "_"),
                "symbol": str(row["Symbol"]),
                "open": float(str(row[open_col]).replace(",", "")),
                "high": float(str(row[high_col]).replace(",", "")),
                "low": float(str(row[low_col]).replace(",", "")),
                "close": float(str(row[close_col]).replace(",", ""))
            }
            
            # Add volume data if available
            if volume_col and volume_col in df.columns:
                try:
                    entry["volume"] = float(str(row[volume_col]).replace(",", ""))
                except (ValueError, TypeError):
                    print(f"Error processing volume for row: {row}")
            
            data.append(entry)
        except ValueError as e:
            print(f"Error processing row: {row}. Error: {e}")
            continue
    
    return data

# Function to filter out data older than 1.5 years
def filter_old_data(data):
    one_and_half_years_ago = datetime.now() - timedelta(days=548)  # 1.5 years
    filtered_data = []
    
    for entry in data:
        try:
            entry_date = datetime.strptime(entry["time"], "%Y_%m_%d")
            if entry_date >= one_and_half_years_ago:
                filtered_data.append(entry)
        except ValueError:
            print(f"Invalid date format in entry: {entry['time']}")
            continue
    
    return filtered_data

# Function to reorganize data by symbol and sort chronologically
def reorganize_data(data):
    # Group data by symbol
    symbol_groups = defaultdict(list)
    for entry in data:
        symbol_groups[entry['symbol']].append(entry)
    
    # Sort each symbol's data by time and flatten into a single list
    reorganized_data = []
    for symbol in sorted(symbol_groups.keys()):
        sorted_entries = sorted(symbol_groups[symbol], key=lambda x: x['time'])
        reorganized_data.extend(sorted_entries)
    
    return reorganized_data

# Main script
# Update output path to save in public folder
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, '..'))
public_dir = os.path.join(project_root, 'public')

# Ensure public directory exists
if not os.path.exists(public_dir):
    print(f"Public directory not found at {public_dir}. Creating it...")
    try:
        os.makedirs(public_dir)
    except Exception as e:
        print(f"Error creating public directory: {e}")

# Set the output file path to the public directory
output_file = os.path.join(public_dir, "organized_nepse_data.json")
print(f"Output file will be saved to: {output_file}")

# Also keep a copy in the data-scripts directory for backward compatibility
local_output_file = os.path.join(script_dir, "organized_nepse_data.json")

# Load existing data from JSON file if it exists (try public folder first, then local)
existing_data = []
if os.path.exists(output_file):
    try:
        with open(output_file, "r") as file:
            existing_data = json.load(file)
        if not isinstance(existing_data, list):
            existing_data = []
        print(f"Loaded existing data from public folder: {len(existing_data)} entries")
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error reading existing JSON file from public folder: {e}")
        # Try local copy as fallback
        if os.path.exists(local_output_file):
            try:
                with open(local_output_file, "r") as file:
                    existing_data = json.load(file)
                if not isinstance(existing_data, list):
                    existing_data = []
                print(f"Loaded existing data from local folder: {len(existing_data)} entries")
            except (json.JSONDecodeError, IOError) as e:
                print(f"Error reading local JSON file: {e}")
                existing_data = []
        else:
            existing_data = []
else:
    # Try local copy as fallback
    if os.path.exists(local_output_file):
        try:
            with open(local_output_file, "r") as file:
                existing_data = json.load(file)
            if not isinstance(existing_data, list):
                existing_data = []
            print(f"No file in public folder. Loaded existing data from local folder: {len(existing_data)} entries")
        except (json.JSONDecodeError, IOError) as e:
            print(f"Error reading local JSON file: {e}")
            existing_data = []
    else:
        existing_data = []

# Create a dictionary to look up entries by time and symbol for faster updates
existing_lookup = {}
for entry in existing_data:
    key = f"{entry['time']}_{entry['symbol']}"
    existing_lookup[key] = entry

# Process new data from files
new_data = []

# Store lists of processed files to delete later
processed_excel_files = []
processed_csv_files = []

# Find all Excel and CSV files in the current directory
script_dir = os.path.dirname(os.path.abspath(__file__))
excel_files = glob.glob(os.path.join(script_dir, "*.xlsx"))
csv_files = glob.glob(os.path.join(script_dir, "*.csv"))

print(f"Found {len(excel_files)} Excel files and {len(csv_files)} CSV files")

# Process all Excel files
for input_file in excel_files:
    print(f"Processing Excel file: {input_file}")
    try:
        # Read the Excel file
        xls = pd.ExcelFile(input_file)
        
        # Iterate through each sheet in the Excel file
        for sheet_name in xls.sheet_names:
            df = pd.read_excel(input_file, sheet_name=sheet_name)
            sheet_data = process_data(df, date_source="sheet_name", sheet_name=sheet_name)
            new_data.extend(sheet_data)
        
        # Add the file to the list of processed files
        processed_excel_files.append(input_file)
    except Exception as e:
        print(f"Error processing Excel file {input_file}: {e}")

# Process all CSV files
for input_file in csv_files:
    print(f"Processing CSV file: {input_file}")
    try:
        # Extract date from filename if it follows pattern "Today's Price - YYYY-MM-DD.csv"
        file_date = None
        if "Today's Price -" in input_file:
            try:
                date_str = input_file.split("Today's Price - ")[1].split(".csv")[0]
                file_date = datetime.strptime(date_str, "%Y-%m-%d").strftime("%Y_%m_%d")
            except Exception as e:
                print(f"Could not extract date from filename: {e}")
        
        # Read the CSV file with improved parsing
        df = pd.read_csv(input_file, quoting=csv.QUOTE_ALL, on_bad_lines='skip')
        
        # If we successfully extracted a date from the filename and Business Date doesn't exist
        if file_date and "Business Date" not in df.columns:
            df["Business Date"] = file_date.replace("_", "-")
            
        sheet_data = process_data(df, date_source="csv")
        new_data.extend(sheet_data)
        
        # Add the file to the list of processed files
        processed_csv_files.append(input_file)
    except pd.errors.ParserError as e:
        print(f"Error parsing CSV file {input_file}: {e}")
        # Fallback: Manually read the CSV to debug problematic rows
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                header = next(reader)  # Skip header
                for i, row in enumerate(reader, start=2):  # Start counting from line 2
                    if len(row) != len(header):
                        print(f"Line {i} has {len(row)} fields, expected {len(header)}: {row}")
                        continue
        except Exception as e:
            print(f"Failed to manually inspect the CSV file: {e}")
    except Exception as e:
        print(f"Error processing CSV file {input_file}: {e}")

# Merge new data with existing data
for entry in new_data:
    key = f"{entry['time']}_{entry['symbol']}"
    
    if key in existing_lookup:
        # If entry exists, update OHLC data and preserve volume if new data doesn't have it
        if "volume" not in entry and "volume" in existing_lookup[key]:
            entry["volume"] = existing_lookup[key]["volume"]
    
    existing_lookup[key] = entry

# Convert the lookup dictionary back to a list
merged_data = list(existing_lookup.values())

# Filter out data older than 1.5 years
filtered_data = filter_old_data(merged_data)

# Reorganize data by symbol and sort chronologically
organized_data = reorganize_data(filtered_data)

# Save the processed data to the public folder
print(f"Saving {len(organized_data)} entries to {output_file}")
try:
    with open(output_file, "w") as file:
        json.dump(organized_data, file, indent=2)
    print(f"Successfully saved data to public folder: {output_file}")
except Exception as e:
    print(f"Error saving to public folder: {e}")

# Also save a copy in the data-scripts directory for backward compatibility
try:
    with open(local_output_file, "w") as file:
        json.dump(organized_data, file, indent=2)
    print(f"Successfully saved backup copy to: {local_output_file}")
except Exception as e:
    print(f"Error saving backup copy: {e}")

print("Processing completed successfully!")

# Optionally, move processed files to a backup directory
# This is commented out for safety, uncomment when ready to use
"""
backup_dir = os.path.join(os.path.dirname(__file__), "processed_files")
if not os.path.exists(backup_dir):
    os.makedirs(backup_dir)

for file_path in processed_excel_files + processed_csv_files:
    file_name = os.path.basename(file_path)
    backup_path = os.path.join(backup_dir, file_name)
    try:
        os.rename(file_path, backup_path)
        print(f"Moved {file_name} to processed_files directory")
    except Exception as e:
        print(f"Error moving file {file_name}: {e}")
""" 