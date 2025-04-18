from datetime import datetime
import json
import os
import time

from config import IDLE_THRESHOLD, LOG_FILE, TRACK_INTERVAL
from utils import get_active_window, get_idle_time


def log_usage():
    """
    Main function to continuously log user activity.
    This runs in a separate thread.
    """
    print("Starting activity logger...")
    
    # Ensure we're using the config values
    from config import TRACK_INTERVAL, LOG_FILE, LOG_DIR
    
    # Make sure the log directory exists
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, 'w') as f:
            json.dump([], f)
    
    last_window_title = None
    last_app_name = None
    last_status = None

    while True:
        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            idle_time = get_idle_time()

            current_window_title = "idle"
            current_app_name = "idle"
            current_status = "idle"

            if idle_time < IDLE_THRESHOLD:
                window_title, app_name = get_active_window()
                if window_title and app_name:
                    current_window_title = window_title
                    current_app_name = app_name
                    current_status = "active"
            
            if (current_window_title != last_window_title or
                current_app_name != last_app_name or
                current_status != last_status):
                # If the last status was active, log a "closed" entry for the previous window
                if last_status == "active":
                    closed_entry = {
                        "timestamp": timestamp,
                        "window_title": last_window_title,
                        "app_name": last_app_name,
                        "category": "",
                        "status": "closed"
                    }
                    with open(LOG_FILE, 'r+') as f:
                        data = json.load(f)
                        data.append(closed_entry)
                        f.seek(0)
                        json.dump(data, f, indent=2)
                
                entry = {
                    "timestamp": timestamp,
                    "window_title": current_window_title,
                    "app_name": current_app_name,
                    "category": "" if current_status != "idle" else "N/A",
                    "status": current_status
                }

                with open(LOG_FILE, 'r+') as f:
                    data = json.load(f)
                    data.append(entry)
                    f.seek(0)
                    json.dump(data, f, indent=2)
                
                last_window_title = current_window_title
                last_app_name = current_app_name
                last_status = current_status

            # Sleep for the configured interval (now 5 minutes)
            time.sleep(TRACK_INTERVAL)
        except Exception as e:
            print(f"Error in activity logger: {e}")
            time.sleep(TRACK_INTERVAL)  # Sleep even on error