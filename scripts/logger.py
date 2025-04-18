from datetime import datetime
import json
import os
import time

from config import IDLE_THRESHOLD, LOG_FILE, TRACK_INTERVAL
from utils import get_active_window, get_idle_time


def log_usage():
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, 'w') as f:
            json.dump([], f)

    while True:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        idle_time = get_idle_time()

        entry = {
            "timestamp": timestamp,
            "window_title": "idle",
            "app_name": "idle",
            "category": "N/A",
            "status": "idle"
        }

        if idle_time < IDLE_THRESHOLD:
            window_title, app_name = get_active_window()
            entry.update({
                "window_title": window_title,
                "app_name": app_name,
                "category": "",
                "status": "active"
            })

        with open(LOG_FILE, 'r+') as f:
            data = json.load(f)
            data.append(entry)
            f.seek(0)
            json.dump(data, f, indent=2)

        time.sleep(TRACK_INTERVAL)