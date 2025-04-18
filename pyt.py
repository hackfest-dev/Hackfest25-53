import subprocess
import psutil
import time
from datetime import datetime
import csv
import os

CATEGORIES = {
    "firefox": "Productivity",
    "chrome": "Productivity",
    "code": "Development",
    "slack": "Communication",
    "spotify": "Entertainment",
}

def get_active_window():
    try:
        window_id = subprocess.check_output(["xdotool", "getactivewindow"]).strip().decode("utf-8")
        window_name = subprocess.check_output(["xdotool", "getwindowname", window_id]).strip().decode("utf-8")
        pid = subprocess.check_output(["xdotool", "getwindowpid", window_id]).strip().decode("utf-8")
        process_name = psutil.Process(int(pid)).name()
        category = CATEGORIES.get(process_name, "Uncategorized")
        return window_name, process_name, category
    except Exception as e:
        return None, None, None

def get_idle_time():
    idle_time = subprocess.check_output("xprintidle").strip().decode("utf-8")
    return int(idle_time) / 1000

def log_usage(log_file, idle_threshold=300):
    with open(log_file, 'a', newline='') as file:
        writer = csv.writer(file)
        while True:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            idle_time = get_idle_time()
            if idle_time < idle_threshold:
                window_title, app_name, category = get_active_window()
                writer.writerow([timestamp, window_title, app_name, category, "Active"])
            else:
                writer.writerow([timestamp, "Idle", "Idle", "Idle", "Idle"])
            time.sleep(5)

if __name__ == "__main__":
    log_file = "logs/usage_log.csv"
    if not os.path.isfile(log_file):
        with open(log_file, 'w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(["Timestamp", "Window Title", "Application Name", "Category", "Status"])

    log_usage(log_file)