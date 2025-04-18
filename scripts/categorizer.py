import os
import json
import time
from datetime import datetime
import threading

# Import configurations
from config import LOG_FILE, CATEGORY_FILE, CATEGORY_UPDATE_INTERVAL

# Global tracking variables
last_file_write_time = 0
# Increase the interval to avoid any accidental refresh
VERY_STRICT_FILE_WRITE_INTERVAL = 300  # Exactly 5 minutes (300 seconds)
in_memory_data = []
write_lock = threading.Lock()

def categorize_entries():
    """Process log entries but only store in memory"""
    global in_memory_data
    
    try:
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, 'r') as f:
                log_data = json.load(f)
            
            # Store data in memory only (don't write to file yet)
            in_memory_data = log_data  # Replace with actual categorization logic
            print(f"Updated in-memory data: {len(in_memory_data)} entries at {datetime.now().strftime('%H:%M:%S')}")
        else:
            print(f"Warning: Log file not found: {LOG_FILE}")
    except Exception as e:
        print(f"Error in categorize_entries: {e}")

def time_until_next_write():
    """Return seconds until next scheduled write"""
    global last_file_write_time
    current_time = time.time()
    elapsed = current_time - last_file_write_time
    return max(0, VERY_STRICT_FILE_WRITE_INTERVAL - elapsed)

def write_to_file_if_needed():
    """Write to file only if the time threshold is met, with thread safety"""
    global last_file_write_time, in_memory_data
    
    # Get the lock to ensure thread safety
    with write_lock:
        current_time = time.time()
        time_since_last_write = current_time - last_file_write_time
        
        # Only write if at least 5 minutes have passed
        if time_since_last_write >= VERY_STRICT_FILE_WRITE_INTERVAL:
            try:
                temp_file = f"{CATEGORY_FILE}.tmp"
                
                # Write to temporary file first
                with open(temp_file, 'w') as f:
                    json.dump(in_memory_data, f)
                
                # Atomically replace the real file
                os.replace(temp_file, CATEGORY_FILE)
                
                last_file_write_time = current_time
                next_write = datetime.fromtimestamp(current_time + VERY_STRICT_FILE_WRITE_INTERVAL)
                print(f"File updated at {datetime.now().strftime('%H:%M:%S')}")
                print(f"Next update scheduled at: {next_write.strftime('%H:%M:%S')}")
            except Exception as e:
                print(f"Error writing to file: {e}")
        else:
            # Print time remaining until next write
            remaining = VERY_STRICT_FILE_WRITE_INTERVAL - time_since_last_write
            if remaining % 60 < 1:  # Only print once a minute to reduce spam
                print(f"Next file write in {int(remaining)} seconds")

def start_categorizer_loop():
    """Main loop that enforces the update schedule"""
    global last_file_write_time
    
    print("Starting categorizer loop with VERY strict file update interval")
    last_file_write_time = time.time()  # Initialize with current time
    
    # For debugging - show when next file write will occur
    next_write_time = datetime.fromtimestamp(last_file_write_time + VERY_STRICT_FILE_WRITE_INTERVAL)
    print(f"First file write scheduled at: {next_write_time.strftime('%H:%M:%S')}")
    
    while True:
        try:
            # Update data in memory
            categorize_entries()
            
            # Check if we should write to file
            write_to_file_if_needed()
            
            # Sleep for a while before next check
            time.sleep(CATEGORY_UPDATE_INTERVAL)
        except Exception as e:
            print(f"Error in categorizer loop: {e}")
            time.sleep(CATEGORY_UPDATE_INTERVAL)